document.addEventListener('DOMContentLoaded', () => {
  const chatForm = document.getElementById('chat-form');
  const userInput = document.getElementById('user-input');
  const chatBox = document.getElementById('chat-box');
  const submitButton = chatForm.querySelector('button[type="submit"]');
  const themeToggle = document.getElementById('theme-toggle');

  // Store the conversation history (array of { role, text })
  let conversationHelper = [];

  // Theme Toggling Logic
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.body.setAttribute('data-theme', savedTheme);
  themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

  themeToggle.addEventListener('click', () => {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';
  });

  /**
   * Simple Markdown Parser
   * Converts **bold**, *italic*, - lists, 1. lists, and newlines to HTML.
   * @param {string} text - The raw text from the API.
   * @return {string} The HTML string.
   */
  function parseMarkdown(text) {
    if (!text) return '';

    // 1. Escape HTML (prevent XSS)
    let safeText = text.replace(/&/g, "&amp;")
                       .replace(/</g, "&lt;")
                       .replace(/>/g, "&gt;");

    // 2. Bold (**text**)
    safeText = safeText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // 3. Italic (*text*)
    safeText = safeText.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // 4. Unordered Lists (- item)
    // We look for lines starting with "- "
    safeText = safeText.replace(/^\s*-\s+(.*)$/gm, '<li>$1</li>');

    // 5. Ordered Lists (1. item)
    safeText = safeText.replace(/^\s*\d+\.\s+(.*)$/gm, '<li>$1</li>');

    // 6. Wrap lists in <ul> or <ol> (This is a naive implementation but works for simple cases)
    // Note: A robust parser would handle nested lists, but this is simple regex.
    // We will just wrap contiguous <li>s in <ul> for simplicity.
    // For ordered vs unordered, regex replacement is tricky without state, so we'll default to <ul> 
    // or we can try to detect sequences.
    // Let's stick to valid HTML structure by just converting newlines to <br> for non-list items first.
    
    // Split into lines to process block elements
    const lines = safeText.split('\n');
    let html = '';
    let inList = false;

    lines.forEach(line => {
        if (line.includes('<li>')) {
            if (!inList) {
                html += '<ul>';
                inList = true;
            }
            html += line;
        } else {
            if (inList) {
                html += '</ul>';
                inList = false;
            }
            // Add non-empty lines as paragraphs or just text
            if (line.trim()) {
                html += `<p>${line}</p>`;
            }
        }
    });
    if (inList) html += '</ul>';

    return html;
  }

  /**
   * Adds a message to the chat box UI.
   * @param {string} role - 'user' or 'model'.
   * @param {string} text - Message text.
   * @return {HTMLElement} The created message div.
   */
  function addMessage(role, text) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', `${role}-message`); // 'user-message' or 'model-message'
    
    if (role === 'model') {
       // Parse markdown for model
       messageDiv.innerHTML = parseMarkdown(text);
    } else {
       // Plain text for user (already escaped in innerText/textContent mostly, but let's be safe)
       messageDiv.textContent = text;
    }
    
    chatBox.appendChild(messageDiv);
    scrollToBottom();
    return messageDiv;
  }

  /**
   * Scrolls the chat box to the bottom.
   */
  function scrollToBottom() {
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  /**
   * Toggles the input and button state.
   * @param {boolean} disabled - Whether to disable the inputs.
   */
  function setFormState(disabled) {
    userInput.disabled = disabled;
    submitButton.disabled = disabled;
    if (!disabled) {
      userInput.focus();
    }
  }

  // Handle form submission
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = userInput.value.trim();
    if (!text) return;

    // 1. Add user message to UI
    addMessage('user', text);
    
    // 2. Add to conversation history
    conversationHelper.push({ role: 'user', text: text });
    
    // Clear input and disable form
    userInput.value = '';
    setFormState(true);

    // 3. Show "Thinking..." placeholder
    // Note: We use a placeholder that will be replaced.
    const thinkingMessageDiv = document.createElement('div');
    thinkingMessageDiv.classList.add('message', 'model-message');
    thinkingMessageDiv.textContent = 'Thinking...';
    chatBox.appendChild(thinkingMessageDiv);
    scrollToBottom();

    try {
      // 4. Send request to backend
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation: conversationHelper })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();

      if (data && data.result) {
        // 5. Replace "Thinking..." with actual response
        thinkingMessageDiv.innerHTML = parseMarkdown(data.result);
        
        // Add to history
        conversationHelper.push({ role: 'model', text: data.result });
      } else {
        thinkingMessageDiv.textContent = 'Sorry, no response received.';
      }

    } catch (error) {
      console.error('Chat Error:', error);
      thinkingMessageDiv.textContent = 'Failed to get response from server.';
    } finally {
      // 6. Re-enable form
      setFormState(false);
      scrollToBottom();
    }
  });
});