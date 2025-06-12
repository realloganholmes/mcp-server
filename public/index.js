const chat = document.getElementById('chat');

function handleKeyDown(event) {
  if (event.key === "Enter") {
    sendMessage();
  }
}

function addSpreadsheetLinkToChat(chat, data) {
    const { base64, filename, mimeType } = data.response;

    const link = document.createElement('a');
    link.href = `data:${mimeType};base64,${base64}`;
    link.download = filename;
    link.innerText = `Download ${filename}`;
    link.style.color = '#1a73e8';
    link.style.textDecoration = 'underline';

    const container = document.createElement('div');
    container.className = 'message agent';
    container.innerHTML = `<strong>Agent:</strong> `;
    container.appendChild(link);
    chat.appendChild(container);
}

async function sendMessage() {
    const input = document.getElementById('input');
    const message = input.value.trim();
    if (!message) return;

    // Show user message
    chat.innerHTML += `<div class="message user"><strong>You:</strong> ${message}</div>`;
    chat.scrollTop = chat.scrollHeight

    input.value = '';

    const res = await fetch('http://localhost:3000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
    });

    const data = await res.json();
    if (data.response) {
        if (data.response.status === 'success' && data.response.base64 && data.response.filename && data.response.mimeType) {
            addSpreadsheetLinkToChat(chat, data)
        } else {
            chat.innerHTML += `<div class="message agent"><strong>Agent:</strong> ${marked.parse(data.response)}</div>`;
        }
    } else {
        chat.innerHTML += `<div class="message agent"><strong>Agent:</strong> Error occurred.</div>`;
    }

    chat.scrollTop = chat.scrollHeight
}

// Progress updates via /events (SSE)
const eventSource = new EventSource('http://localhost:3000/events');

eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.message) {
        chat.innerHTML += `<div class="message progress">${data.message}</div>`;
        chat.scrollTop = chat.scrollHeight
    }
};