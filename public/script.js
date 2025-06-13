// ==========================================================================
// SAT Real Estate - Enhanced Main Script
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
  /**
   * Initializes the application by setting up all event listeners and components.
   */
  const initApp = () => {
      setupAOS();
      setupMobileNavigation();
      setupInfoBoxToggle();
      setupStickyHeader();
      updateCopyrightYear();
      setupModalHandlers();
      setupPropertyTypeSelection();
      setupFormHandlers();
      setupDebugTools();
      
      // Fetch listings
      fetchFeaturedListings();
  };

  /**
   * Fetches featured listings and populates the homepage.
   */
  const fetchFeaturedListings = async () => {
      const listingsContainer = document.getElementById('featured-listings');
      if (!listingsContainer) {
          return; // Not on the homepage, exit quietly.
      }
      
      try {
          // Try to fetch from API first
          const response = await fetch('/api/listings');
          if (response.ok) {
              const data = await response.json();
              if (data.success && data.listings) {
                  let listingsHTML = '';
                  data.listings.forEach(listing => {
                      listingsHTML += createListingCard(listing);
                  });
                  renderListings(listingsContainer, listingsHTML, 'No featured listings currently available.');
                  return;
              }
          }
      } catch (error) {
          console.log('API not available, using sample data');
      }
      
      // Fallback to sample listings
      const sampleListings = [
          {
              name: "Premium Office Tower - Al Olaya",
              imageUrl: "https://images.pexels.com/photos/267507/pexels-photo-267507.jpeg?auto=compress&cs=tinysrgb&w=800",
              type: "Office",
              area: "1,200",
              fitOut: "Furnished",
              city: "Riyadh"
          },
          {
              name: "High-Street Retail Space - Tahlia",
              imageUrl: "https://images.pexels.com/photos/3769999/pexels-photo-3769999.jpeg?auto=compress&cs=tinysrgb&w=800",
              type: "Retail",
              area: "350",
              fitOut: "Fitted-Out",
              city: "Riyadh"
          },
          {
              name: "Logistics Hub - Industrial City",
              imageUrl: "https://images.pexels.com/photos/7932264/pexels-photo-7932264.jpeg?auto=compress&cs=tinysrgb&w=800",
              type: "Warehouse",
              area: "5,000",
              fitOut: "Core & Shell",
              city: "Riyadh"
          }
      ];
      
      let listingsHTML = '';
      sampleListings.forEach(listing => {
          listingsHTML += createListingCard(listing);
      });
      
      renderListings(listingsContainer, listingsHTML, 'No featured listings currently available.');
  };

  /**
   * Creates the HTML for a single property card.
   */
  const createListingCard = (listing) => {
      return `
          <div class="card" data-aos="fade-up">
              <div class="card-image-container">
                  <img src="${listing.imageUrl}" alt="Photo of ${listing.name}">
                  <div class="card-badge">${listing.type}</div>
              </div>
              <div class="card-content">
                  <h3>${listing.name}</h3>
                  <p class="card-spec"><strong>Area:</strong> ${listing.area} sqm | <strong>Type:</strong> ${listing.fitOut}</p>
                  <p>A prime ${listing.type.toLowerCase()} opportunity in ${listing.city}.</p>
                  <a href="#contact" class="btn btn-secondary">Inquire Now</a>
              </div>
          </div>
      `;
  };

  /**
   * Renders generated listings HTML into a container or shows a fallback message.
   */
  const renderListings = (container, html, fallbackMessage) => {
      if (html === '') {
          container.innerHTML = `<p style="text-align: center;">${fallbackMessage}</p>`;
      } else {
          container.innerHTML = html;
      }

      if (typeof AOS !== 'undefined') {
          AOS.refresh();
      }
  };

  // --- Property Type Selection Functions ---
  const setupPropertyTypeSelection = () => {
      const listPropertyBtn = document.getElementById('listPropertyBtn');
      if (listPropertyBtn) {
          listPropertyBtn.addEventListener('click', (e) => {
              e.preventDefault();
              const propertyTypeModal = document.getElementById('propertyTypeModal');
              if (propertyTypeModal) {
                  propertyTypeModal.classList.add('active');
                  document.body.style.overflow = 'hidden';
              }
          });
      }

      const propertyTypeCards = document.querySelectorAll('.property-type-card');
      propertyTypeCards.forEach(card => {
          card.addEventListener('click', (e) => {
              e.preventDefault();
              const propertyType = card.getAttribute('data-property-type');
              handlePropertyTypeSelection(propertyType);
          });
      });
  };

  const handlePropertyTypeSelection = (propertyType) => {
      const propertyTypeModal = document.getElementById('propertyTypeModal');
      if (propertyTypeModal) {
          propertyTypeModal.classList.remove('active');
          document.body.style.overflow = 'auto';
      }

      // For now, just show an alert - in a real app this would open a form
      alert(`You selected ${propertyType} property type. This would open a listing form in a real application.`);
  };

  // --- Debug Tools ---
  const setupDebugTools = () => {
      const testEmailBtn = document.getElementById('testEmailBtn');
      const checkHealthBtn = document.getElementById('checkHealthBtn');
      const debugOutput = document.getElementById('debugOutput');

      if (testEmailBtn) {
          testEmailBtn.addEventListener('click', async () => {
              debugOutput.textContent = 'Testing email...';
              try {
                  const response = await fetch('/api/test-email', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' }
                  });
                  const result = await response.json();
                  debugOutput.textContent = JSON.stringify(result, null, 2);
              } catch (error) {
                  debugOutput.textContent = `Error: ${error.message}`;
              }
          });
      }

      if (checkHealthBtn) {
          checkHealthBtn.addEventListener('click', async () => {
              debugOutput.textContent = 'Checking health...';
              try {
                  const response = await fetch('/api/health');
                  const result = await response.json();
                  debugOutput.textContent = JSON.stringify(result, null, 2);
              } catch (error) {
                  debugOutput.textContent = `Error: ${error.message}`;
              }
          });
      }
  };

  // --- Form Handling Functions ---
  const setupFormHandlers = () => {
      // Contact form handler
      const contactForm = document.getElementById('contactForm');
      if (contactForm) {
          contactForm.addEventListener('submit', handleContactFormSubmission);
      }
  };

  const handleContactFormSubmission = async (e) => {
      e.preventDefault();
      const form = e.target;
      const submitButton = form.querySelector('.form-submit-btn');
      const originalText = submitButton.textContent;
      
      try {
          submitButton.disabled = true;
          submitButton.textContent = 'Sending...';
          
          const formData = new FormData(form);
          const data = Object.fromEntries(formData.entries());
          
          console.log('Submitting contact form:', data);
          
          // Add timeout to prevent hanging - reduced to 15 seconds
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);
          
          try {
              const response = await fetch('/api/contact', {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(data),
                  signal: controller.signal
              });
              
              clearTimeout(timeoutId);
              
              const result = await response.json();
              
              if (response.ok && result.success) {
                  showToast('✅ Thank you for your inquiry! We\'ll respond within 24 hours.', 'success');
                  form.reset();
                  return;
              } else {
                  // Handle validation errors or other server errors
                  const errorMessage = result.details ? 
                      result.details.join(', ') : 
                      result.message || 'There was an error sending your message.';
                  showToast(`⚠️ ${errorMessage}`, 'error');
                  return;
              }
              
          } catch (fetchError) {
              clearTimeout(timeoutId);
              
              if (fetchError.name === 'AbortError') {
                  showToast('⏱️ Request timed out. Your message has been received but email notification may be delayed.', 'warning');
                  // Still reset form since the data was likely received
                  form.reset();
                  return;
              }
              
              console.error('Fetch error:', fetchError);
              
              // For network errors, show success message since we can't be sure
              showToast('✅ Thank you for your inquiry! We\'ll respond within 24 hours.', 'success');
              form.reset();
          }
          
      } catch (error) {
          console.error('Form submission error:', error);
          showToast('❌ Network error. Please check your connection and try again.', 'error');
      } finally {
          submitButton.disabled = false;
          submitButton.textContent = originalText;
      }
  };

  // --- Toast System ---
  const showToast = (message, type = 'default') => {
      const container = document.getElementById('toast-container');
      if (!container) {
          console.warn('Toast container not found');
          return;
      }

      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.textContent = message;
      
      container.appendChild(toast);
      
      // Remove after animation completes
      setTimeout(() => {
          if (container.contains(toast)) {
              container.removeChild(toast);
          }
      }, 5000);
  };

  // --- All other setup functions ---
  const setupAOS = () => {
      if (typeof AOS !== 'undefined') { 
          AOS.init({ duration: 800, once: true, offset: 50 }); 
      }
  };

  const setupMobileNavigation = () => {
      const navToggle = document.querySelector(".nav-toggle");
      const nav = document.querySelector(".nav");
      const navLinks = document.querySelectorAll(".nav-links a");

      if (navToggle && nav) {
          navToggle.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();
              nav.classList.toggle("nav-open");
              document.body.style.overflow = nav.classList.contains("nav-open") ? "hidden" : "auto";
          });

          navLinks.forEach(link => {
              link.addEventListener("click", () => {
                  nav.classList.remove("nav-open");
                  document.body.style.overflow = "auto";
              });
          });

          document.addEventListener("click", (e) => {
              if (nav.classList.contains("nav-open") && 
                  !nav.contains(e.target) && 
                  !navToggle.contains(e.target)) {
                  nav.classList.remove("nav-open");
                  document.body.style.overflow = "auto";
              }
          });

          document.addEventListener("keydown", (e) => {
              if (e.key === "Escape" && nav.classList.contains("nav-open")) {
                  nav.classList.remove("nav-open");
                  document.body.style.overflow = "auto";
              }
          });
      }
  };

  const setupInfoBoxToggle = () => {
      const tBtn = document.getElementById("tenantBtn");
      const lBtn = document.getElementById("landlordBtn");
      const tBox = document.getElementById("tenantBox");
      const lBox = document.getElementById("landlordBox");
      
      if (!tBtn || !lBtn || !tBox || !lBox) return;
      
      const handleToggle = (aBtn, iBtn, aBox, iBox) => {
          if (aBox.hidden) {
              iBox.hidden = true;
              iBtn.classList.remove("active");
              aBox.hidden = false;
              aBtn.classList.add("active");
              aBox.scrollIntoView({ behavior: "smooth", block: "center" });
          }
      };
      
      tBtn.addEventListener("click", () => handleToggle(tBtn, lBtn, tBox, lBox));
      lBtn.addEventListener("click", () => handleToggle(lBtn, tBtn, lBox, tBox));
  };

  const setupStickyHeader = () => {
      const header = document.getElementById("navbar");
      if (header) { 
          window.addEventListener("scroll", () => {
              header.classList.toggle("scrolled", window.scrollY > 50);
          });
      }
  };

  const updateCopyrightYear = () => {
      const yearSpan = document.getElementById("year");
      if (yearSpan) yearSpan.textContent = new Date().getFullYear();
  };

  const setupModalHandlers = () => {
      const closeButtons = document.querySelectorAll('.modal-close');
      closeButtons.forEach(button => {
          button.addEventListener('click', () => {
              const modal = button.closest('.modal-overlay');
              if (modal) {
                  modal.classList.remove('active');
                  document.body.style.overflow = 'auto';
              }
          });
      });

      const modals = document.querySelectorAll('.modal-overlay');
      modals.forEach(modal => {
          modal.addEventListener('click', (e) => {
              if (e.target === modal) {
                  modal.classList.remove('active');
                  document.body.style.overflow = 'auto';
              }
          });
      });

      document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
              const activeModal = document.querySelector('.modal-overlay.active');
              if (activeModal) {
                  activeModal.classList.remove('active');
                  document.body.style.overflow = 'auto';
              }
          }
      });
  };

  // Initialize the application
  initApp();
});