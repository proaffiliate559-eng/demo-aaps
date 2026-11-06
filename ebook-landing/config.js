/* ============================================================
   CONFIG: sirf yahi file edit karni hai.
   ============================================================ */

// Razorpay / Instamojo / Cosmofeed payment page link yahan paste karein.
// Saare "Kharido" buttons isi link par jayenge.
const PAYMENT_LINK = "https://rzp.io/l/YOUR-PAYMENT-LINK";

// Ebook PDF ka download link (Google Drive / Dropbox / apna server).
// Ye /thank-you page ke download button par lagega.
const DOWNLOAD_LINK = "https://YOUR-DOWNLOAD-LINK";

// Contact details (footer aur Contact Us page par dikhenge).
const CONTACT_EMAIL = "your-email@example.com";
const WHATSAPP_NUMBER = "91XXXXXXXXXX"; // country code ke saath, bina + ya space ke

/* ---------- Neeche kuch change karne ki zarurat nahi ---------- */
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll("[data-pay]").forEach(function (a) {
    a.href = PAYMENT_LINK;
  });
  document.querySelectorAll("[data-download]").forEach(function (a) {
    a.href = DOWNLOAD_LINK;
  });
  document.querySelectorAll("[data-email]").forEach(function (a) {
    a.href = "mailto:" + CONTACT_EMAIL;
    a.textContent = CONTACT_EMAIL;
  });
  document.querySelectorAll("[data-whatsapp]").forEach(function (a) {
    a.href = "https://wa.me/" + WHATSAPP_NUMBER;
    a.textContent = "+" + WHATSAPP_NUMBER;
  });
  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
});
