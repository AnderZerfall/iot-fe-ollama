# Ollama Chat (Next.js)

Мінімалістичний чат на Next.js, який напряму викликає Ollama REST API (`/api/tags`, `/api/chat`).

## Збірка
    npm install
    npm run build      # статичний експорт у ./out

## Запуск без вебсервера
Відкрийте `out/index.html` у браузері (file://).

## Ollama
    OLLAMA_ORIGINS="*" ollama serve
    # на окремому хості: OLLAMA_HOST=0.0.0.0 OLLAMA_ORIGINS="*" ollama serve
