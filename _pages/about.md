---
layout: aql
title: Home
permalink: /
---

<section class="hero">
  <div>
    <h1>{{ site.data.aql_home.heading | escape }}</h1>
    <p class="hero-intro">{{ site.data.aql_home.intro | escape }}</p>
    {% if site.data.aql_home.credentials and site.data.aql_home.credentials != empty %}
      <p class="hero-credentials">{{ site.data.aql_home.credentials | escape }}</p>
    {% endif %}
  </div>
  <figure class="neuron" hidden>
    <canvas tabindex="0" aria-label="Rotatable 3D neuron" aria-describedby="neuron-help"></canvas>
    <figcaption>
      <span id="neuron-help">Drag To Rotate<span class="sr-only"> You can also use the arrow keys.</span></span>
      <button class="neuron-signal" type="button" aria-haspopup="dialog" aria-controls="signal-contact">Signal Me <span aria-hidden="true">↗</span></button>
    </figcaption>
  </figure>
</section>

<script src="{{ '/assets/js/aql-neuron.js' | relative_url }}" defer></script>

<section class="home-posts" aria-labelledby="posts-title">
  <h2 id="posts-title" class="section-heading">{{ site.data.aql_home.posts_heading | escape }}</h2>
  {% include aql-post-list.html %}
</section>

<dialog id="signal-contact" aria-labelledby="signal-title">
  <div class="signal-header">
    <h2 id="signal-title" tabindex="-1" autofocus>Signal Me</h2>
    <form method="dialog">
      <button class="tool-button" type="submit" aria-label="Close contact form">×</button>
    </form>
  </div>
  <form id="signal-enquiry" name="signal-enquiry" method="post" action="{{ '/' | relative_url }}" data-netlify="true" netlify-honeypot="bot-field">
    <input type="hidden" name="form-name" value="signal-enquiry">
    <p hidden><label>Leave this field empty <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
    <label for="signal-name">Name</label>
    <input id="signal-name" name="name" autocomplete="name" maxlength="120" required>
    <label for="signal-email">Email</label>
    <input id="signal-email" name="email" type="email" autocomplete="email" maxlength="254" required>
    <label for="signal-message">Message</label>
    <textarea id="signal-message" name="message" rows="5" maxlength="4000" required></textarea>
    <button class="signal-submit" type="submit">Send enquiry</button>
  </form>
  <p class="signal-status" role="status"></p>
</dialog>
<script src="{{ '/assets/js/aql-contact.js' | relative_url }}" defer></script>
