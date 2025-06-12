const chat = document.getElementById('chat');

function addHtmlToChat(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    chat.appendChild(div);
}

function handleKeyDown(event) {
  if (event.key === "Enter") {
    sendMessage();
  }
}

function renderChart(chartData) {
    const canvas = document.createElement('canvas');
    const container = document.createElement('div');
    container.className = 'message agent';
    container.innerHTML = `<strong>Agent:</strong> ${chartData.title}`;
    container.appendChild(canvas);
    chat.appendChild(container);

    new Chart(canvas.getContext('2d'), {
        type: chartData.chartType,
        data: {
            labels: chartData.labels,
            datasets: chartData.datasets
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: chartData.title }
            }
        }
    });
}

function addSpreadsheetLinkToChat(data) {
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
    addHtmlToChat(`<div class="message user"><strong>You:</strong> ${message}</div>`);
    chat.scrollTop = chat.scrollHeight

    input.value = '';

    const res = await fetch('http://localhost:3000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
    });

    const data = await res.json();
    if (data.response) {
        if (data.response.type === 'spreadsheet') {
            addSpreadsheetLinkToChat(data);
        } else if (data.response.type === 'chart') {
            renderChart(data.response.arguments);
        } else {
            addHtmlToChat(`<div class="message agent"><strong>Agent:</strong> ${marked.parse(data.response.content)}</div>`);
        }
    } else {
        addHtmlToChat(`<div class="message agent"><strong>Agent:</strong> Error occurred.</div>`);
    }

    chat.scrollTop = chat.scrollHeight
}

// Progress updates via /events (SSE)
const eventSource = new EventSource('http://localhost:3000/events');

eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.message) {
        addHtmlToChat(`<div class="message progress">${data.message}</div>`);
        chat.scrollTop = chat.scrollHeight
    }
};