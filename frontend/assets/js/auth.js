// ===== Auth Helpers =====

function saveSession(tokenData) {
  localStorage.setItem("access_token", tokenData.access_token);
  localStorage.setItem("user", JSON.stringify(tokenData.user));
}

function getUser() {
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}

function logout() {
  confirmAction({
    title: "Log Out?",
    message: "Are you sure you want to log out of your session?",
    confirmText: "Log Out",
    cancelText: "Cancel",
    type: "primary",
    icon: "log-out",
    onConfirm: () => {
      sessionStorage.setItem("flash_toast_msg", "You have been logged out safely.");
      sessionStorage.setItem("flash_toast_type", "info");
      sessionStorage.setItem("flash_toast_title", "Signed Out");
      localStorage.clear();
      window.location.href = "index.html";
    }
  });
}

function requireAuth() {
  const token = localStorage.getItem("access_token");
  if (!token) {
    window.location.href = "index.html";
  }
}

function toggleProfileDropdown(e) {
  if (e) e.stopPropagation();
  const card = document.getElementById("profile-dropdown-card");
  if (card) {
    card.classList.toggle("active");
    if (typeof lucide !== "undefined") {
      lucide.createIcons();
    }
  }
}

document.addEventListener("click", (e) => {
  const wrapper = document.querySelector(".user-profile-wrapper");
  const card = document.getElementById("profile-dropdown-card");
  if (wrapper && card && !wrapper.contains(e.target)) {
    card.classList.remove("active");
  }
});

// ===== Login Form Handler =====
const loginForm = document.getElementById("login-form");
if (loginForm) {

  // If already logged in, skip the login page
  if (localStorage.getItem("access_token")) {
    window.location.href = "dashboard.html";
  }

  const submitBtn = loginForm.querySelector("button[type=submit]");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const inputUser = document.getElementById("username");
    const inputPass = document.getElementById("password");
    inputUser.classList.remove("is-invalid");
    inputPass.classList.remove("is-invalid");

    const username = inputUser.value.trim();
    const password = inputPass.value;

    let hasErr = false;
    if (!username) { inputUser.classList.add("is-invalid"); hasErr = true; }
    if (!password) { inputPass.classList.add("is-invalid"); hasErr = true; }

    if (hasErr) {
      showToast("Please fill in all required fields.", "warning", "Validation Error");
      return;
    }

    // Loading state
    submitBtn.disabled = true;
    submitBtn.classList.add("is-loading");
    submitBtn.innerHTML = '<i data-lucide="loader-2"></i> Signing in...';
    document.querySelector(".auth-card").classList.add("is-loading");
    lucide.createIcons();

    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      saveSession(data);
      sessionStorage.setItem("flash_toast_msg", `Welcome back, ${data.user.full_name || data.user.username}!`);
      sessionStorage.setItem("flash_toast_type", "success");
      sessionStorage.setItem("flash_toast_title", "Login Successful");
      window.location.href = "dashboard.html";
    } catch (err) {
      errorEl.textContent = err.message === "Invalid credentials"
        ? "Incorrect username or password."
        : err.message;
      errorEl.style.display = "block";
      showToast("Invalid credentials. Please check your details.", "danger", "Login Failed");

      submitBtn.disabled = false;
      submitBtn.classList.remove("is-loading");
      submitBtn.innerHTML = '<i data-lucide="log-in"></i> Sign In';
      document.querySelector(".auth-card").classList.remove("is-loading");
      lucide.createIcons();
    }
  });
}
