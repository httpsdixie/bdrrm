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

  const inputUser = document.getElementById("username");
  const inputPass = document.getElementById("password");

  [inputUser, inputPass].forEach((el) => {
    if (el) {
      el.addEventListener("input", () => {
        el.classList.remove("is-invalid");
        const errorEl = document.getElementById("login-error");
        if (errorEl && (!inputUser || !inputUser.classList.contains("is-invalid")) && (!inputPass || !inputPass.classList.contains("is-invalid"))) {
          errorEl.style.display = "none";
        }
      });
    }
  });

  const submitBtn = loginForm.querySelector("button[type=submit]");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (inputUser) inputUser.classList.remove("is-invalid");
    if (inputPass) inputPass.classList.remove("is-invalid");

    const username = inputUser.value.trim();
    const password = inputPass.value;

    let hasErr = false;
    if (!username) { inputUser.classList.add("is-invalid"); hasErr = true; }
    if (!password) { inputPass.classList.add("is-invalid"); hasErr = true; }

    if (hasErr) {
      showToast("Please fill in all required fields.", "warning", "Validation Error");
      return;
    }

    const errorEl = document.getElementById("login-error");
    if (errorEl) {
      errorEl.style.display = "none";
      errorEl.textContent = "";
    }

    // Loading state
    submitBtn.disabled = true;
    submitBtn.classList.add("is-loading");
    submitBtn.innerHTML = '<i data-lucide="loader-2"></i> Signing in...';
    document.querySelector(".auth-card").classList.add("is-loading");
    if (typeof lucide !== "undefined") lucide.createIcons();

    try {
      let data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      if (data.requires_2fa) {
        submitBtn.disabled = false;
        submitBtn.classList.remove("is-loading");
        submitBtn.innerHTML = '<i data-lucide="log-in"></i> Sign In';
        document.querySelector(".auth-card").classList.remove("is-loading");
        if (typeof lucide !== "undefined") lucide.createIcons();

        window._pendingAuthCreds = { username, password };
        const modal = document.getElementById("totp-modal-overlay");
        const totpInput = document.getElementById("totp-code-input");
        const totpErr = document.getElementById("totp-error");

        if (modal) {
          modal.classList.add("active");
          if (totpErr) { totpErr.style.display = "none"; totpErr.textContent = ""; }
          if (totpInput) { 
            totpInput.value = ""; 
            setTimeout(() => totpInput.focus(), 100);
          }
          if (typeof lucide !== "undefined") lucide.createIcons();
        }
        return;
      }

      if (!data || !data.user) {
        throw new Error("Invalid response from login server.");
      }

      saveSession(data);
      sessionStorage.setItem("flash_toast_msg", `Welcome back, ${data.user.full_name || data.user.username}!`);
      sessionStorage.setItem("flash_toast_type", "success");
      sessionStorage.setItem("flash_toast_title", "Login Successful");
      window.location.href = "dashboard.html";
    } catch (err) {
      const msg = (err.message && (err.message.includes("401") || err.message.includes("Invalid") || err.message.includes("credentials")))
        ? "Incorrect username or password. Please try again."
        : (err.message || "Login failed. Please check your credentials.");

      if (inputUser) inputUser.classList.add("is-invalid");
      if (inputPass) inputPass.classList.add("is-invalid");

      if (errorEl) {
        if (msg.includes("locked out") || msg.includes("5 consecutive")) {
          errorEl.innerHTML = `<div>${msg}</div><a href="javascript:void(0)" onclick="resetDemoLockout()" style="color:#fbbf24;font-weight:700;text-decoration:underline;display:inline-block;margin-top:0.4rem;cursor:pointer;">[Demo Reset: Unlock Account Now]</a>`;
        } else {
          errorEl.textContent = msg;
        }
        errorEl.style.display = "block";
        errorEl.style.color = "#f87171";
        errorEl.style.fontSize = ".82rem";
        errorEl.style.marginTop = ".6rem";
        errorEl.style.textAlign = "center";
      }

      submitBtn.disabled = false;
      submitBtn.classList.remove("is-loading");
      submitBtn.innerHTML = '<i data-lucide="log-in"></i> Sign In';
      document.querySelector(".auth-card").classList.remove("is-loading");
      if (typeof lucide !== "undefined") lucide.createIcons();
    }
  });
}

// ===== 2FA TOTP Modal Handlers =====
function closeTotpModal() {
  const modal = document.getElementById("totp-modal-overlay");
  if (modal) modal.classList.remove("active");
  window._pendingAuthCreds = null;
}

async function submitTotpCode() {
  const creds = window._pendingAuthCreds;
  if (!creds) { closeTotpModal(); return; }

  const totpInput = document.getElementById("totp-code-input");
  const errorEl = document.getElementById("totp-error");
  const btn = document.getElementById("totp-verify-btn");

  const code = (totpInput ? totpInput.value : "").trim();
  if (code.length !== 6) {
    if (errorEl) {
      errorEl.textContent = "Please enter a 6-digit TOTP code.";
      errorEl.style.display = "block";
    }
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2"></i> Verifying...';
    if (typeof lucide !== "undefined") lucide.createIcons();
  }

  try {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: creds.username, password: creds.password, totp_code: code }),
    });

    if (!data || !data.user) {
      throw new Error("Invalid 2FA verification code.");
    }

    saveSession(data);
    sessionStorage.setItem("flash_toast_msg", `Welcome back, ${data.user.full_name || data.user.username}!`);
    sessionStorage.setItem("flash_toast_type", "success");
    sessionStorage.setItem("flash_toast_title", "Login Successful");
    window.location.href = "dashboard.html";
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err.message || "Invalid 2FA code. Please try again.";
      errorEl.style.display = "block";
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="check"></i> Verify';
      if (typeof lucide !== "undefined") lucide.createIcons();
    }
  }
}

// ===== Password Recovery 3-Step Wizard Handlers =====
function openForgotPasswordModal() {
  const modal = document.getElementById("forgot-password-modal-overlay");
  if (modal) {
    modal.classList.add("active");
    const userIn = document.getElementById("forgot-username");
    const totpIn = document.getElementById("forgot-totp");
    const hiddenToken = document.getElementById("reset-token-hidden");
    const passIn = document.getElementById("reset-password");
    const passConf = document.getElementById("reset-password-confirm");

    if (totpIn) totpIn.value = "";
    if (hiddenToken) hiddenToken.value = "";
    if (passIn) passIn.value = "";
    if (passConf) passConf.value = "";

    if (userIn) {
      userIn.value = document.getElementById("username") ? document.getElementById("username").value : "";
    }
    goToForgotStep(1);
    if (typeof lucide !== "undefined") lucide.createIcons();
  }
}

function closeForgotPasswordModal() {
  const modal = document.getElementById("forgot-password-modal-overlay");
  if (modal) modal.classList.remove("active");
}

function goToForgotStep(stepNum) {
  const step1 = document.getElementById("forgot-step-1");
  const step2 = document.getElementById("forgot-step-2");
  const step3 = document.getElementById("forgot-step-3");

  const ind1 = document.getElementById("step-indicator-1");
  const ind2 = document.getElementById("step-indicator-2");
  const ind3 = document.getElementById("step-indicator-3");

  const num1 = document.getElementById("step-num-1");
  const num2 = document.getElementById("step-num-2");
  const num3 = document.getElementById("step-num-3");

  [1, 2, 3].forEach(n => {
    const err = document.getElementById(`forgot-error-${n}`);
    if (err) { err.style.display = "none"; err.textContent = ""; }
  });

  if (step1) step1.style.display = stepNum === 1 ? "block" : "none";
  if (step2) step2.style.display = stepNum === 2 ? "block" : "none";
  if (step3) step3.style.display = stepNum === 3 ? "block" : "none";

  if (ind1) ind1.style.color = stepNum >= 1 ? "#60a5fa" : "#64748b";
  if (ind2) ind2.style.color = stepNum >= 2 ? "#60a5fa" : "#64748b";
  if (ind3) ind3.style.color = stepNum >= 3 ? "#60a5fa" : "#64748b";

  if (num1) { num1.style.background = stepNum >= 1 ? "#2563eb" : "rgba(255,255,255,0.1)"; num1.style.color = stepNum >= 1 ? "#ffffff" : "#64748b"; }
  if (num2) { num2.style.background = stepNum >= 2 ? "#2563eb" : "rgba(255,255,255,0.1)"; num2.style.color = stepNum >= 2 ? "#ffffff" : "#64748b"; }
  if (num3) { num3.style.background = stepNum >= 3 ? "#2563eb" : "rgba(255,255,255,0.1)"; num3.style.color = stepNum >= 3 ? "#ffffff" : "#64748b"; }

  if (stepNum === 1) {
    const userIn = document.getElementById("forgot-username");
    if (userIn) setTimeout(() => userIn.focus(), 100);
  } else if (stepNum === 2) {
    const totpIn = document.getElementById("forgot-totp");
    if (totpIn) setTimeout(() => totpIn.focus(), 100);
  } else if (stepNum === 3) {
    const pwIn = document.getElementById("reset-password");
    if (pwIn) setTimeout(() => pwIn.focus(), 100);
  }

  if (typeof lucide !== "undefined") lucide.createIcons();
}

function checkPasswordRules(pwd) {
  const rLength = document.getElementById("rule-length");
  const rUpper = document.getElementById("rule-upper");
  const rNum = document.getElementById("rule-num");
  const rSpec = document.getElementById("rule-spec");

  const updateRule = (el, valid, text) => {
    if (!el) return;
    if (valid) {
      el.style.color = "#4ade80";
      el.innerHTML = `<i data-lucide="check" style="width:11px;height:11px;vertical-align:middle;"></i> ${text}`;
    } else {
      el.style.color = "#94a3b8";
      el.innerHTML = `<i data-lucide="circle-dashed" style="width:11px;height:11px;vertical-align:middle;"></i> ${text}`;
    }
  };

  updateRule(rLength, pwd.length >= 8, "8+ Chars");
  updateRule(rUpper, /[A-Z]/.test(pwd), "1 Uppercase");
  updateRule(rNum, /[0-9]/.test(pwd), "1 Number");
  updateRule(rSpec, /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd), "1 Special Symbol");
  if (typeof lucide !== "undefined") lucide.createIcons();
}

function togglePasswordVisibility(inputId, btnEl) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isHidden = input.type === "password";
  input.type = isHidden ? "text" : "password";
  btnEl.innerHTML = isHidden ? '<i data-lucide="eye-off"></i>' : '<i data-lucide="eye"></i>';
  if (typeof lucide !== "undefined") lucide.createIcons();
}

async function submitForgotStep1() {
  const usernameInput = document.getElementById("forgot-username");
  const errorEl = document.getElementById("forgot-error-1");
  const btn = document.getElementById("btn-forgot-step1");

  if (errorEl) { errorEl.style.display = "none"; errorEl.textContent = ""; }

  const username = usernameInput ? usernameInput.value.trim() : "";
  if (!username) {
    if (errorEl) {
      errorEl.style.display = "block";
      errorEl.textContent = "Please enter your username.";
    }
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2"></i> Checking...';
    if (typeof lucide !== "undefined") lucide.createIcons();
  }

  try {
    await apiFetch("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ username }),
    });

    goToForgotStep(2);
  } catch (err) {
    if (errorEl) {
      errorEl.style.display = "block";
      errorEl.textContent = err.message || "User account not found.";
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = 'Continue <i data-lucide="arrow-right"></i>';
      if (typeof lucide !== "undefined") lucide.createIcons();
    }
  }
}

async function submitForgotStep2() {
  const usernameInput = document.getElementById("forgot-username");
  const totpInput = document.getElementById("forgot-totp");
  const errorEl = document.getElementById("forgot-error-2");
  const btn = document.getElementById("btn-forgot-step2");

  if (errorEl) { errorEl.style.display = "none"; errorEl.textContent = ""; }

  const username = usernameInput ? usernameInput.value.trim() : "";
  const totpCode = totpInput ? totpInput.value.trim() : "";

  if (totpCode.length !== 6) {
    if (errorEl) {
      errorEl.style.display = "block";
      errorEl.textContent = "Please enter a valid 6-digit OTP code.";
    }
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2"></i> Verifying...';
    if (typeof lucide !== "undefined") lucide.createIcons();
  }

  try {
    const data = await apiFetch("/auth/verify-recovery-otp", {
      method: "POST",
      body: JSON.stringify({ username, totp_code: totpCode }),
    });

    const hiddenToken = document.getElementById("reset-token-hidden");
    if (hiddenToken && data.reset_token) {
      hiddenToken.value = data.reset_token;
    } else if (hiddenToken) {
      hiddenToken.value = "";
    }

    goToForgotStep(3);
  } catch (err) {
    if (errorEl) {
      errorEl.style.display = "block";
      errorEl.textContent = err.message || "Invalid 6-digit OTP code. Please try again.";
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = 'Verify OTP <i data-lucide="arrow-right"></i>';
      if (typeof lucide !== "undefined") lucide.createIcons();
    }
  }
}

async function submitPasswordReset() {
  const hiddenToken = document.getElementById("reset-token-hidden");
  const passwordInput = document.getElementById("reset-password");
  const confirmInput = document.getElementById("reset-password-confirm");
  const errorEl = document.getElementById("forgot-error-3");
  const btn = document.getElementById("btn-submit-reset");

  if (errorEl) { errorEl.style.display = "none"; errorEl.textContent = ""; }

  const token = hiddenToken ? hiddenToken.value.trim() : "";
  const newPassword = passwordInput ? passwordInput.value : "";
  const confirmPassword = confirmInput ? confirmInput.value : "";

  if (!token) {
    if (errorEl) { errorEl.style.display = "block"; errorEl.textContent = "Session expired. Please restart recovery."; }
    return;
  }
  if (!newPassword) {
    if (errorEl) { errorEl.style.display = "block"; errorEl.textContent = "Please enter a new password."; }
    return;
  }
  if (newPassword !== confirmPassword) {
    if (errorEl) { errorEl.style.display = "block"; errorEl.textContent = "Passwords do not match. Please verify."; }
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2"></i> Saving...';
    if (typeof lucide !== "undefined") lucide.createIcons();
  }

  try {
    await apiFetch("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({
        reset_token: token,
        new_password: newPassword,
      }),
    });

    closeForgotPasswordModal();
    if (typeof showToast === "function") {
      showToast("Password reset successful! Please sign in with your new password.", "success", "Password Updated");
    }
  } catch (err) {
    if (errorEl) {
      errorEl.style.display = "block";
      errorEl.textContent = err.message || "Unable to reset password.";
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="check"></i> Save Password';
      if (typeof lucide !== "undefined") lucide.createIcons();
    }
  }
}

// Keypress listeners for all OTP / step inputs
document.addEventListener("DOMContentLoaded", () => {
  // Login form — Enter on username or password fields
  const loginUser = document.getElementById("username");
  const loginPass = document.getElementById("password");
  [loginUser, loginPass].forEach((el) => {
    if (el) {
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const form = document.getElementById("login-form");
          if (form) form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
        }
      });
    }
  });

  // 2FA login modal
  const totpInput = document.getElementById("totp-code-input");
  if (totpInput) {
    totpInput.addEventListener("keyup", (e) => {
      if (e.key === "Enter") submitTotpCode();
    });
  }

  // Forgot password — step 1 username
  const forgotUser = document.getElementById("forgot-username");
  if (forgotUser) {
    forgotUser.addEventListener("keyup", (e) => {
      if (e.key === "Enter") submitForgotStep1();
    });
  }

  // Forgot password — step 2 OTP
  const forgotTotp = document.getElementById("forgot-totp");
  if (forgotTotp) {
    forgotTotp.addEventListener("keyup", (e) => {
      if (e.key === "Enter") submitForgotStep2();
    });
  }

  // Forgot password — step 3 new password / confirm
  const resetPass = document.getElementById("reset-password");
  const resetConf = document.getElementById("reset-password-confirm");
  if (resetPass) {
    resetPass.addEventListener("keyup", (e) => {
      if (e.key === "Enter") submitPasswordReset();
    });
  }
  if (resetConf) {
    resetConf.addEventListener("keyup", (e) => {
      if (e.key === "Enter") submitPasswordReset();
    });
  }
});

// One-click demo credentials auto-fill helper
function quickFillDemo() {
  const userIn = document.getElementById("username");
  const passIn = document.getElementById("password");
  if (userIn) userIn.value = "admin";
  if (passIn) passIn.value = "@Admin2026!";
  
  if (userIn) userIn.classList.remove("is-invalid");
  if (passIn) passIn.classList.remove("is-invalid");

  const errEl = document.getElementById("login-error");
  if (errEl) { errEl.style.display = "none"; errEl.textContent = ""; }

  if (typeof showToast === "function") {
    showToast("Demo credentials filled into login form!", "info", "Quick Fill");
  }
}

// One-click demo lockout reset helper
async function resetDemoLockout() {
  try {
    const data = await apiFetch("/auth/reset-lockout", { method: "POST" });
    const userIn = document.getElementById("username");
    const passIn = document.getElementById("password");
    if (userIn) userIn.classList.remove("is-invalid");
    if (passIn) passIn.classList.remove("is-invalid");

    const errEl = document.getElementById("login-error");
    if (errEl) { errEl.style.display = "none"; errEl.textContent = ""; }

    if (typeof showToast === "function") {
      showToast(data.message || "Demo account security lockout cleared!", "success", "Lockout Cleared");
    }
  } catch (err) {
    if (typeof showToast === "function") {
      showToast(err.message || "Unable to clear lockout", "danger", "Reset Failed");
    }
  }
}
