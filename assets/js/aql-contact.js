(() => {
  const opener = document.querySelector(".neuron-signal");
  const dialog = document.querySelector("#signal-contact");
  const form = document.querySelector("#signal-enquiry");
  const status = dialog.querySelector(".signal-status");
  const submit = form.querySelector("button[type=submit]");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let openTimer;

  opener.addEventListener("click", () => {
    clearTimeout(openTimer);
    openTimer = setTimeout(() => {
      if (dialog.open) return;
      if (form.hidden) {
        form.hidden = false;
        status.textContent = "";
      }
      dialog.showModal();
      // Focusing the heading first keeps mobile keyboards closed until a field is tapped.
      dialog.querySelector("#signal-title").focus();
    }, reduceMotion.matches ? 0 : 650);
  });

  dialog.addEventListener("close", () => opener.focus());

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    submit.disabled = true;
    status.textContent = "Sending…";

    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(new FormData(form)),
      });
      if (!response.ok) throw new Error("Submission failed");
      form.reset();
      dialog.querySelector("#signal-title").focus();
      form.hidden = true;
      status.textContent = "Signal received. Thanks for getting in touch.";
    } catch {
      status.textContent = "Your message couldn’t be sent. Please try again.";
    } finally {
      submit.disabled = false;
    }
  });
})();
