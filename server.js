// server.js

require('dotenv').config();

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Firebase Admin SDK
let db, bucket;
try {
  const serviceAccount = require('./config/firebase-admin-key.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
  db = admin.firestore();
  bucket = admin.storage().bucket();
  console.log('✅ Firebase initialized successfully');
} catch (err) {
  console.error('❌ Firebase initialization failed:', err.message);
  console.log('📝 Please ensure you have placed your firebase-admin-key.json in ./config/');
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024, files: 12 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'images') {
      return file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Only images allowed'), false);
    }
    if (file.fieldname === 'videos') {
      return file.mimetype.startsWith('video/') ? cb(null, true) : cb(new Error('Only videos allowed'), false);
    }
    cb(new Error('Unexpected field'), false);
  }
});

// Nodemailer transporter
let transporter;
try {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  console.log('✅ Email transporter configured');
} catch (err) {
  console.error('❌ Email configuration failed:', err.message);
}

// Utility functions
const generateListingId = () => `SAT-${Date.now()}-${uuidv4()}`;

const validateFormData = (data, type) => {
  const errs = [];
  const required = ['firstName','lastName','email','phone','company','address','city','area'];
  const typeFields = {
    office: ['fitout','rent'],
    retail: ['retailType','rent'],
    warehouse: ['warehouseType','rent'],
    land: ['plotType','price']
  };
  [...required, ...(typeFields[type]||[])].forEach(f => {
    if (!data[f] || data[f].toString().trim()==='') errs.push(`${f} is required`);
  });
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errs.push('Invalid email');
  if (data.phone && !/^(\+966|966|0)?5[0-9]{8}$/.test(data.phone.replace(/\s/g,''))) errs.push('Invalid Saudi phone');
  ['area','rent','price'].forEach(f => {
    if (data[f] && (isNaN(data[f])||parseFloat(data[f])<0)) errs.push(`${f} must be positive number`);
  });
  return errs;
};

const processImage = async (buf) => {
  return sharp(buf)
    .resize(1920,1080,{ fit:'inside', withoutEnlargement:true })
    .jpeg({ quality:85, progressive:true })
    .toBuffer();
};

const uploadFile = async (buf, name, type) => {
  if (!bucket) throw new Error('Storage not initialized');
  const file = bucket.file(`listings/${name}`);
  await file.save(buf, { metadata:{ contentType:type } });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/listings/${name}`;
};

const sendNotification = async (data, id) => {
  if (!transporter) return;
  const adminOpt = {
    from: process.env.SMTP_USER,
    to: 'leasing@satestate.com',
    subject: `New ${data.listingType} Listing - ${id}`,
    html: `<p>Listing ID: ${id}</p><p>Type: ${data.listingType}</p>`
  };
  const userOpt = {
    from: process.env.SMTP_USER,
    to: data.email,
    subject: 'We received your listing',
    html: `<p>Thanks ${data.firstName}, your listing ${id} is under review.</p>`
  };
  try {
    await transporter.sendMail(adminOpt);
    await transporter.sendMail(userOpt);
    console.log('✅ Emails sent');
  } catch (err) {
    console.error('❌ Email send failed:', err);
  }
};

// Health endpoint
app.get('/api/health', (req,res) => {
  res.json({
    status:'OK',
    firebase:!!db,
    email:!!transporter,
    storage:!!bucket
  });
});

// Listing submissions
app.post('/api/listings/:type', upload.fields([
  { name:'images', maxCount:10 },
  { name:'videos', maxCount:2 }
]), async (req,res) => {
  try {
    const type = req.params.type;
    if (!['office','retail','warehouse','land'].includes(type)) {
      return res.status(400).json({ success:false, message:'Invalid listing type' });
    }
    const errs = validateFormData(req.body, type);
    if (errs.length) return res.status(400).json({ success:false, errors:errs });

    const id = generateListingId();
    const imageUrls = [];
    const videoUrls = [];

    // Upload images
    if (req.files.images && bucket) {
      for (let i=0; i<req.files.images.length; i++) {
        const buf = await processImage(req.files.images[i].buffer);
        const url = await uploadFile(buf, `${id}_img_${i}.jpg`, 'image/jpeg');
        imageUrls.push(url);
      }
    }

    // Upload videos
    if (req.files.videos && bucket) {
      for (let i=0; i<req.files.videos.length; i++) {
        const vid = req.files.videos[i];
        const url = await uploadFile(vid.buffer, `${id}_vid_${i}.${path.extname(vid.originalname)}`, vid.mimetype);
        videoUrls.push(url);
      }
    }

    const listingData = {
      id, listingType:type, status:'pending',
      submittedAt: db ? admin.firestore.FieldValue.serverTimestamp() : new Date().toISOString(),
      firstName:req.body.firstName, lastName:req.body.lastName,
      email:req.body.email, phone:req.body.phone,
      company:req.body.company, address:req.body.address,
      city:req.body.city, area:parseFloat(req.body.area),
      images:imageUrls, videos:videoUrls,
      notes:req.body.notes||'',
      // add type‐specific fields here...
    };

    if (db) {
      await db.collection('listing_submissions').doc(id).set(listingData);
      console.log('✅ Saved to Firestore');
    } else {
      console.log('⚠️ Firestore not available. Data:', listingData);
    }

    await sendNotification(listingData, id);

    res.json({ success:true, listingId:id });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ success:false, message:'Server error' });
  }
});

// Contact form
app.post('/api/contact', async (req,res) => {
  try {
    const { firstName, lastName, email, phone, company, inquiryType, message } = req.body;
    if (!firstName||!lastName||!email||!message) {
      return res.status(400).json({ success:false, message:'Missing required fields' });
    }
    const mailOpts = {
      from: process.env.SMTP_USER,
      to: 'leasing@satestate.com',
      subject: `Contact Form: ${firstName} ${lastName}`,
      html: `
        <p><strong>Name:</strong> ${firstName} ${lastName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone||'N/A'}</p>
        <p><strong>Company:</strong> ${company||'N/A'}</p>
        <p><strong>Inquiry:</strong> ${inquiryType}</p>
        <p><strong>Message:</strong><br/>${message}</p>
      `
    };
    if (transporter) {
      await transporter.sendMail(mailOpts);
      console.log('✅ Contact email sent');
    } else {
      console.log('⚠️ Skipping email (no transporter)');
    }
    res.json({ success:true, message:'Inquiry received' });
  } catch (err) {
    console.error('Contact error:', err);
    res.status(500).json({ success:false, message:'Server error' });
  }
});

// Error handler
app.use((err,req,res,next) => {
  console.error('Unhandled:', err);
  res.status(500).json({ success:false, message:err.message||'Unknown error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 SAT Real Estate Backend Server running on port ${PORT}`);
  console.log(`📡 Health: http://localhost:${PORT}/api/health`);
  console.log(`🌐 Frontend: http://localhost:${PORT}`);
});
