const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { nanoid } = require('nanoid');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CHARACTERS_FILE = path.join(DATA_DIR, 'characters.json');

app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'local-session-secret',
    resave: false,
    saveUninitialized: false,
  })
);

async function ensureDataFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(USERS_FILE);
  } catch (error) {
    const initialUsers = {
      users: [
        {
          id: 'admin-1',
          username: 'admin',
          password: 'admin123',
          role: 'admin',
          characterId: null,
        },
      ],
    };
    await fs.writeFile(USERS_FILE, JSON.stringify(initialUsers, null, 2));
  }

  try {
    await fs.access(CHARACTERS_FILE);
  } catch (error) {
    const initialCharacters = { characters: [] };
    await fs.writeFile(CHARACTERS_FILE, JSON.stringify(initialCharacters, null, 2));
  }
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

async function getUsers() {
  const data = await readJson(USERS_FILE);
  return data.users;
}

async function saveUsers(users) {
  await writeJson(USERS_FILE, { users });
}

async function getCharacters() {
  const data = await readJson(CHARACTERS_FILE);
  return data.characters.map((character) => normalizeCharacter(character));
}

async function saveCharacters(characters) {
  await writeJson(CHARACTERS_FILE, {
    characters: characters.map((character) => normalizeCharacter(character)),
  });
}

function normalizeCharacter(character) {
  const normalized = { ...character };
  const validStatuses = ['locked', 'inactive', 'active', 'deleted'];
  if (!validStatuses.includes(normalized.status)) {
    normalized.status = normalized.filled ? 'inactive' : 'locked';
  }
  if (normalized.status !== 'locked' && !normalized.filled) {
    normalized.status = 'locked';
  }
  return normalized;
}

function escapeHtml(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout(title, body) {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background: #f3f3f3;
      margin: 0;
      padding: 24px;
      color: #1f1f1f;
    }
    .container {
      max-width: 640px;
      margin: 0 auto;
      background: #fff;
      padding: 24px;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.08);
    }
    h1, h2 {
      margin-top: 0;
    }
    form {
      display: grid;
      gap: 12px;
    }
    label {
      font-weight: 600;
    }
    input, textarea, select {
      width: 100%;
      padding: 8px 12px;
      font-size: 16px;
    }
    textarea {
      min-height: 80px;
    }
    button {
      padding: 10px 16px;
      font-size: 16px;
      border: none;
      border-radius: 8px;
      background: #2f5cf7;
      color: #fff;
      cursor: pointer;
    }
    .muted {
      color: #666;
      font-size: 14px;
    }
    .card {
      padding: 16px;
      background: #fafafa;
      border-radius: 12px;
      border: 1px solid #e3e3e3;
    }
    .list {
      display: grid;
      gap: 12px;
    }
    .list-item {
      padding: 12px;
      border: 1px solid #e3e3e3;
      border-radius: 10px;
      background: #fff;
    }
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 8px;
    }
    .link-button {
      display: inline-block;
      padding: 8px 12px;
      background: #e9eefc;
      color: #2f5cf7;
      text-decoration: none;
      border-radius: 8px;
      font-size: 14px;
    }
    .status-pill {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      color: #fff;
      margin-left: 8px;
    }
    .status-pill.locked {
      background: #1f1f1f;
    }
    .status-pill.inactive {
      background: #6b7280;
    }
    .status-pill.active {
      background: #16a34a;
    }
    .status-pill.deleted {
      background: #dc2626;
    }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
      z-index: 10;
    }
    .modal {
      background: #fff;
      border-radius: 12px;
      padding: 20px;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2);
    }
    .modal h3 {
      margin-top: 0;
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 16px;
    }
    .modal-actions button {
      background: #2f5cf7;
    }
    .modal-actions .secondary {
      background: #e5e7eb;
      color: #1f1f1f;
    }
  </style>
</head>
<body>
  <div class="container">
    ${body}
  </div>
  <div class="modal-backdrop" id="confirmModal" aria-hidden="true">
    <div class="modal" role="dialog" aria-modal="true">
      <h3 id="confirmTitle">Подтверждение</h3>
      <p id="confirmMessage">Вы уверены, что хотите выполнить это действие?</p>
      <div class="modal-actions">
        <button class="secondary" type="button" id="confirmCancel">Отмена</button>
        <button type="button" id="confirmOk">Подтвердить</button>
      </div>
    </div>
  </div>
  <script>
    const modal = document.getElementById('confirmModal');
    const title = document.getElementById('confirmTitle');
    const message = document.getElementById('confirmMessage');
    const cancelButton = document.getElementById('confirmCancel');
    const okButton = document.getElementById('confirmOk');
    let pendingForm = null;

    function openModal(form, text) {
      pendingForm = form;
      if (text) {
        message.textContent = text;
      }
      modal.style.display = 'flex';
      modal.setAttribute('aria-hidden', 'false');
    }

    function closeModal() {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
      pendingForm = null;
    }

    document.querySelectorAll('form[data-confirm]').forEach((form) => {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        openModal(form, form.dataset.confirm);
      });
    });

    cancelButton.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });
    okButton.addEventListener('click', () => {
      if (pendingForm) {
        pendingForm.submit();
      }
      closeModal();
    });
  </script>
</body>
</html>`;
}

function requireAuth(role) {
  return (req, res, next) => {
    if (!req.session.userId) {
      res.redirect('/');
      return;
    }
    if (role && req.session.role !== role) {
      res.status(403).send(layout('Доступ запрещён', '<h1>Нет доступа</h1>'));
      return;
    }
    next();
  };
}

function renderCharacterCard(character) {
  const data = character.data;
  if (!data) {
    return '<p class="muted">Карточка ещё не заполнена.</p>';
  }
  const magicInfo = data.magic?.canUse
    ? `Да (${data.magic.focuses.join(', ') || 'сфера не указана'})`
    : 'Нет';

  return `
    <div class="card">
      <h2>${escapeHtml(data.name)}</h2>
      <p><strong>Раса:</strong> ${escapeHtml(data.race)}</p>
      <p><strong>Класс:</strong> ${escapeHtml(data.class)}</p>
      <p><strong>Возраст:</strong> ${escapeHtml(data.age || 'не указан')}</p>
      <p><strong>Рост:</strong> ${escapeHtml(data.height || 'не указан')}</p>
      <p><strong>Внешность:</strong> ${escapeHtml(data.appearance || 'не указано')}</p>
      <p><strong>Особые черты:</strong> ${escapeHtml(data.traits || 'не указано')}</p>
      <p><strong>Основное оружие:</strong> ${escapeHtml(data.weapon)}</p>
      <p><strong>Магия:</strong> ${escapeHtml(magicInfo)}</p>
      <p><strong>Дополнительно:</strong> ${escapeHtml(data.notes || 'не указано')}</p>
    </div>
  `;
}

app.get('/', async (req, res) => {
  if (req.session.userId) {
    if (req.session.role === 'admin') {
      res.redirect('/admin');
      return;
    }
    res.redirect('/player');
    return;
  }

  const content = `
    <h1>Вход</h1>
    <form method="post" action="/login">
      <div>
        <label for="username">Логин</label>
        <input id="username" name="username" required />
      </div>
      <div>
        <label for="password">Пароль</label>
        <input id="password" name="password" type="password" required />
      </div>
      <button type="submit">Войти</button>
    </form>
  `;
  res.send(layout('Вход', content));
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const users = await getUsers();
  const user = users.find(
    (item) => item.username === username && item.password === password
  );

  if (!user) {
    const content = `
      <h1>Вход</h1>
      <p class="muted">Неверный логин или пароль.</p>
      <a class="link-button" href="/">Попробовать снова</a>
    `;
    res.status(401).send(layout('Ошибка входа', content));
    return;
  }

  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.characterId = user.characterId;

  if (user.role === 'admin') {
    res.redirect('/admin');
    return;
  }
  res.redirect('/player');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.get('/admin', requireAuth('admin'), async (req, res) => {
  const characters = await getCharacters();
  const filter = req.query.filter || 'all';
  const filteredCharacters = characters.filter((character) => {
    if (filter === 'deleted') {
      return character.status === 'deleted';
    }
    if (filter === 'active') {
      return character.status === 'active';
    }
    if (filter === 'inactive') {
      return character.status === 'inactive';
    }
    return character.status !== 'deleted';
  });

  const list = filteredCharacters
    .map((character) => {
      const statusLabels = {
        locked: 'Заблокировано / пусто',
        inactive: 'Не активен',
        active: 'В игре',
        deleted: 'Удалён',
      };
      const statusText = statusLabels[character.status] || 'Неизвестно';
      const canView = character.filled && character.status !== 'deleted';
      const canToggle = character.filled && character.status !== 'deleted';
      const canDelete = character.status !== 'deleted' && character.status !== 'active';
      const canRestore = character.status === 'deleted';
      const actions = `
        <div class="actions">
          ${canView ? `<a class="link-button" href="/admin/characters/${character.id}">Открыть карточку</a>` : ''}
          ${canToggle ? `<form method="post" action="/admin/characters/${character.id}/toggle-active">
              <button type="submit">${character.status === 'active' ? 'Сделать неактивным' : 'Сделать активным'}</button>
            </form>` : ''}
          ${canDelete ? `<form method="post" action="/admin/characters/${character.id}/delete" data-confirm="Удалить персонажа? Он будет перемещён в удалённые.">
              <button type="submit">Удалить</button>
            </form>` : ''}
          ${canRestore ? `<form method="post" action="/admin/characters/${character.id}/restore" data-confirm="Вернуть персонажа в состояние «Не активен»?">
              <button type="submit">Восстановить</button>
            </form>` : ''}
        </div>
      `;
      return `
        <div class="list-item">
          <strong>${escapeHtml(character.username)}</strong>
          <span class="status-pill ${character.status}">${statusText}</span>
          <div class="muted">${character.filled ? `Заполнено: ${escapeHtml(character.data.name)}` : 'Карточка не заполнена'}</div>
          ${actions}
        </div>
      `;
    })
    .join('');

  const content = `
    <h1>Админ-панель</h1>
    <p class="muted">Вы вошли как администратор.</p>
    <div class="actions">
      <a class="link-button" href="/logout">Выйти</a>
    </div>

    <h2>Создать логин игрока</h2>
    <form method="post" action="/admin/create-player">
      <div>
        <label for="new-username">Логин</label>
        <input id="new-username" name="username" required />
      </div>
      <div>
        <label for="new-password">Пароль</label>
        <input id="new-password" name="password" required />
      </div>
      <button type="submit">Создать</button>
    </form>

    <h2>Ячейки персонажей</h2>
    <div class="actions">
      <a class="link-button" href="/admin?filter=all">Все</a>
      <a class="link-button" href="/admin?filter=active">В игре</a>
      <a class="link-button" href="/admin?filter=inactive">Не активные</a>
      <a class="link-button" href="/admin?filter=deleted">Удалённые</a>
    </div>
    <div class="list">
      ${list || '<p class="muted">Пока нет созданных персонажей.</p>'}
    </div>
    ${
      filter === 'deleted'
        ? `<form method="post" action="/admin/characters/purge-deleted" data-confirm="Удалить навсегда всех удалённых персонажей?">
            <button type="submit">Удалить навсегда всех удалённых</button>
          </form>`
        : ''
    }
  `;

  res.send(layout('Админ-панель', content));
});

app.post('/admin/create-player', requireAuth('admin'), async (req, res) => {
  const { username, password } = req.body;
  const users = await getUsers();
  const characters = await getCharacters();

  if (users.some((item) => item.username === username)) {
    const content = `
      <h1>Создание игрока</h1>
      <p class="muted">Логин уже существует.</p>
      <a class="link-button" href="/admin">Назад</a>
    `;
    res.status(400).send(layout('Ошибка', content));
    return;
  }

  const characterId = nanoid(8);
  const userId = nanoid(8);
  const newUser = {
    id: userId,
    username,
    password,
    role: 'player',
    characterId,
  };
  const newCharacter = {
    id: characterId,
    username,
    filled: false,
    data: null,
    status: 'locked',
  };

  users.push(newUser);
  characters.push(newCharacter);

  await saveUsers(users);
  await saveCharacters(characters);

  res.redirect('/admin');
});

app.post('/admin/characters/:id/toggle-active', requireAuth('admin'), async (req, res) => {
  const characters = await getCharacters();
  const character = characters.find((item) => item.id === req.params.id);

  if (!character || !character.filled || character.status === 'deleted') {
    res.redirect('/admin');
    return;
  }

  character.status = character.status === 'active' ? 'inactive' : 'active';
  await saveCharacters(characters);
  res.redirect('/admin');
});

app.post('/admin/characters/:id/delete', requireAuth('admin'), async (req, res) => {
  const characters = await getCharacters();
  const character = characters.find((item) => item.id === req.params.id);

  if (!character || character.status === 'deleted') {
    res.redirect('/admin');
    return;
  }

  if (character.status === 'active') {
    const content = `
      <h1>Удаление невозможно</h1>
      <p class="muted">Нельзя удалить активного персонажа. Сначала сделайте его неактивным.</p>
      <a class="link-button" href="/admin">Назад</a>
    `;
    res.status(400).send(layout('Ошибка удаления', content));
    return;
  }

  character.status = 'deleted';
  await saveCharacters(characters);
  res.redirect('/admin?filter=deleted');
});

app.post('/admin/characters/:id/restore', requireAuth('admin'), async (req, res) => {
  const characters = await getCharacters();
  const character = characters.find((item) => item.id === req.params.id);

  if (!character || character.status !== 'deleted') {
    res.redirect('/admin');
    return;
  }

  character.status = character.filled ? 'inactive' : 'locked';
  await saveCharacters(characters);
  res.redirect('/admin?filter=inactive');
});

app.post('/admin/characters/purge-deleted', requireAuth('admin'), async (req, res) => {
  const characters = await getCharacters();
  const users = await getUsers();
  const deletedIds = new Set(
    characters.filter((item) => item.status === 'deleted').map((item) => item.id)
  );
  const remainingCharacters = characters.filter(
    (item) => item.status !== 'deleted'
  );
  const remainingUsers = users.filter(
    (user) => user.role === 'admin' || !deletedIds.has(user.characterId)
  );

  await saveCharacters(remainingCharacters);
  await saveUsers(remainingUsers);
  res.redirect('/admin');
});

app.get('/admin/characters/:id', requireAuth('admin'), async (req, res) => {
  const characters = await getCharacters();
  const character = characters.find((item) => item.id === req.params.id);

  if (!character || !character.filled) {
    const content = `
      <h1>Карточка недоступна</h1>
      <p class="muted">Персонаж ещё не заполнен.</p>
      <a class="link-button" href="/admin">Назад</a>
    `;
    res.status(404).send(layout('Нет данных', content));
    return;
  }

  const content = `
    <h1>Карточка персонажа</h1>
    ${renderCharacterCard(character)}
    <div class="actions">
      <a class="link-button" href="/admin">Вернуться к списку</a>
      <form method="post" action="/admin/characters/${character.id}/toggle-active">
        <button type="submit">${character.status === 'active' ? 'Сделать неактивным' : 'Сделать активным'}</button>
      </form>
      <a class="link-button" href="/logout">Выйти</a>
    </div>
  `;

  res.send(layout('Карточка персонажа', content));
});

app.get('/player', requireAuth('player'), async (req, res) => {
  const characters = await getCharacters();
  const character = characters.find(
    (item) => item.id === req.session.characterId
  );

  if (!character) {
    const content = `
      <h1>Ошибка</h1>
      <p class="muted">Персонаж не найден. Обратитесь к администратору.</p>
      <a class="link-button" href="/logout">Выйти</a>
    `;
    res.status(404).send(layout('Ошибка', content));
    return;
  }

  if (!character.filled) {
    res.redirect('/player/setup');
    return;
  }

  const content = `
    <h1>Карточка персонажа</h1>
    ${renderCharacterCard(character)}
    <div class="actions">
      <form method="post" action="/player/toggle-active">
        <button type="submit">${character.status === 'active' ? 'Сделать неактивным' : 'Войти в игру'}</button>
      </form>
      <a class="link-button" href="/logout">Выйти</a>
    </div>
  `;

  res.send(layout('Карточка персонажа', content));
});

app.get('/player/setup', requireAuth('player'), async (req, res) => {
  const characters = await getCharacters();
  const character = characters.find(
    (item) => item.id === req.session.characterId
  );

  if (!character) {
    res.redirect('/player');
    return;
  }

  if (character.filled) {
    res.redirect('/player');
    return;
  }

  const content = `
    <h1>Заполнение карточки</h1>
    <form method="post" action="/player/setup">
      <div>
        <label for="name">Имя персонажа</label>
        <input id="name" name="name" required />
      </div>
      <div>
        <label for="race">Раса</label>
        <input id="race" name="race" required />
      </div>
      <div>
        <label for="class">Класс</label>
        <input id="class" name="class" required />
      </div>
      <div>
        <label for="age">Возраст</label>
        <input id="age" name="age" />
      </div>
      <div>
        <label for="height">Рост</label>
        <input id="height" name="height" />
      </div>
      <div>
        <label for="appearance">Внешность</label>
        <textarea id="appearance" name="appearance"></textarea>
      </div>
      <div>
        <label for="traits">Особые черты</label>
        <textarea id="traits" name="traits"></textarea>
      </div>
      <div>
        <label for="weapon">Основное оружие</label>
        <input id="weapon" name="weapon" required />
      </div>
      <div>
        <label>Используете магию?</label>
        <select name="canUseMagic" id="canUseMagic">
          <option value="no">Нет</option>
          <option value="yes">Да</option>
        </select>
      </div>
      <fieldset>
        <legend>Сфера магии (если есть)</legend>
        <label><input type="checkbox" name="magicFocus" value="атака" /> Атака</label><br />
        <label><input type="checkbox" name="magicFocus" value="защита" /> Защита</label><br />
        <label><input type="checkbox" name="magicFocus" value="поддержка" /> Поддержка</label><br />
        <label><input type="checkbox" name="magicFocus" value="особые умения" /> Особые умения</label>
      </fieldset>
      <div>
        <label for="notes">Дополнительная информация</label>
        <textarea id="notes" name="notes"></textarea>
      </div>
      <button type="submit">Сохранить</button>
    </form>
  `;

  res.send(layout('Заполнение карточки', content));
});

app.post('/player/setup', requireAuth('player'), async (req, res) => {
  const characters = await getCharacters();
  const character = characters.find(
    (item) => item.id === req.session.characterId
  );

  if (!character) {
    res.redirect('/player');
    return;
  }

  if (character.filled) {
    res.redirect('/player');
    return;
  }

  const magicFocusRaw = req.body.magicFocus;
  const magicFocuses = Array.isArray(magicFocusRaw)
    ? magicFocusRaw
    : magicFocusRaw
    ? [magicFocusRaw]
    : [];

  character.filled = true;
  character.status = 'inactive';
  character.data = {
    name: req.body.name,
    race: req.body.race,
    class: req.body.class,
    age: req.body.age,
    height: req.body.height,
    appearance: req.body.appearance,
    traits: req.body.traits,
    weapon: req.body.weapon,
    magic: {
      canUse: req.body.canUseMagic === 'yes',
      focuses: magicFocuses,
    },
    notes: req.body.notes,
  };

  await saveCharacters(characters);

  res.redirect('/player');
});

app.post('/player/toggle-active', requireAuth('player'), async (req, res) => {
  const characters = await getCharacters();
  const character = characters.find(
    (item) => item.id === req.session.characterId
  );

  if (!character || !character.filled || character.status === 'deleted') {
    res.redirect('/player');
    return;
  }

  character.status = character.status === 'active' ? 'inactive' : 'active';
  await saveCharacters(characters);
  res.redirect('/player');
});

ensureDataFiles().then(() => {
  app.listen(PORT, HOST, () => {
    const lanIps = Object.values(os.networkInterfaces())
      .flat()
      .filter((details) => details && details.family === 'IPv4' && !details.internal)
      .map((details) => details.address);
    const primaryIp = lanIps[0] || 'не найден';
    console.log(`Server is running on http://localhost:${PORT}`);
    if (primaryIp !== 'не найден') {
      console.log(`LAN IP: ${primaryIp}`);
      console.log(`Откройте на телефоне: http://${primaryIp}:${PORT}/`);
    } else {
      console.log('LAN IP не найден. Проверьте подключение к сети.');
    }
  });
});
