import { useEffect, useState } from "react";
import "./index.css";

type User = {
  id: number;
  fullName: string;
  gender: string;
  age: number;
};

const API_URL = "/api/Users";

function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);

  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadUsers() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(API_URL);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: User[] = await response.json();
      setUsers(data);
    } catch (error) {
      console.error(error);
      setError("Не удалось загрузить пользователей");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function openCreateForm() {
    setEditingId(null);
    setFullName("");
    setGender("");
    setAge("");
    setShowForm(true);
    setError("");
  }

  function openEditForm(user: User) {
    setEditingId(user.id);
    setFullName(user.fullName);
    setGender(user.gender);
    setAge(String(user.age));
    setShowForm(true);
    setError("");
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setFullName("");
    setGender("");
    setAge("");
  }

  async function saveUser() {
    if (fullName.trim() === "") {
      setError("Введите имя");
      return;
    }

    if (gender === "") {
      setError("Выберите пол");
      return;
    }

    const parsedAge = Number(age);

    if (
      !Number.isInteger(parsedAge) ||
      parsedAge < 0 ||
      parsedAge > 150
    ) {
      setError("Введите корректный возраст");
      return;
    }

    const user = {
      id: editingId ?? 0,
      fullName: fullName.trim(),
      gender,
      age: parsedAge,
    };

    try {
      setError("");

      const response = await fetch(API_URL, {
        method: editingId === null ? "POST" : "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(user),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      closeForm();
      await loadUsers();
    } catch (error) {
      console.error(error);
      setError("Не удалось сохранить пользователя");
    }
  }

  async function deleteUser(id: number) {
    const confirmed = window.confirm(
      "Вы действительно хотите удалить пользователя?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      const response = await fetch(`${API_URL}?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      await loadUsers();
    } catch (error) {
      console.error(error);
      setError("Не удалось удалить пользователя");
    }
  }

  return (
    <div className="page">
      <div className="container">
        <header className="top">
          <div>
            <div className="logo">AccountThis</div>
            <h1>Пользователи</h1>
            <p>Управление пользователями системы</p>
          </div>

          <button className="add-button" onClick={openCreateForm}>
            + Добавить пользователя
          </button>
        </header>

        {error && <div className="error">{error}</div>}

        {showForm && (
          <section className="form-card">
            <h2>
              {editingId === null
                ? "Добавить пользователя"
                : "Изменить пользователя"}
            </h2>

            <div className="form">
              <div>
                <label htmlFor="fullName">Имя</label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Иван Иванов"
                />
              </div>

              <div>
                <label htmlFor="gender">Пол</label>
                <select
                  id="gender"
                  value={gender}
                  onChange={(event) => setGender(event.target.value)}
                >
                  <option value="">Выберите пол</option>
                  <option value="Male">Мужской</option>
                  <option value="Female">Женский</option>
                </select>
              </div>

              <div>
                <label htmlFor="age">Возраст</label>
                <input
                  id="age"
                  type="number"
                  min="0"
                  max="150"
                  value={age}
                  onChange={(event) => setAge(event.target.value)}
                  placeholder="20"
                />
              </div>
            </div>

            <div className="form-buttons">
              <button className="cancel-button" onClick={closeForm}>
                Отмена
              </button>

              <button className="save-button" onClick={saveUser}>
                {editingId === null ? "Создать" : "Сохранить"}
              </button>
            </div>
          </section>
        )}

        <section className="card">
          <div className="card-header">
            <h2>Список пользователей</h2>

            <button
              className="refresh-button"
              onClick={loadUsers}
              disabled={loading}
            >
              Обновить
            </button>
          </div>

          {loading ? (
            <div className="message">Загрузка...</div>
          ) : users.length === 0 ? (
            <div className="message">Пользователей пока нет</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Имя</th>
                  <th>Пол</th>
                  <th>Возраст</th>
                  <th>Действия</th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.id}</td>
                    <td>{user.fullName}</td>
                    <td>
                      {user.gender === "Male" ? "Мужской" : "Женский"}
                    </td>
                    <td>{user.age}</td>
                    <td>
                      <button
                        className="edit-button"
                        onClick={() => openEditForm(user)}
                      >
                        Изменить
                      </button>

                      <button
                        className="delete-button"
                        onClick={() => deleteUser(user.id)}
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}

export default App;