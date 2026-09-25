import { useEffect, useState } from 'react';

interface User {
    id: number;
    fullName: string;
    gender: string | null;
    age: number | null;
    createdAt: string;
}

function App() {
    const [users, setUsers] = useState<User[]>([]);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        fetch('/api/users')
            .then((res) => {
                if (!res.ok) throw new Error('Ошибка при получении данных с бэкенда');
                return res.json();
            })
            .then((data) => setUsers(data))
            .catch((err) => setError(err.message));
    }, []);

    return (
        <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
            <h1>Account this! 🚀</h1>
            <h2>Список пользователей из БД:</h2>

            {error && <p style={{ color: 'red' }}>{error}</p>}

            <ul style={{ lineHeight: '1.6' }}>
                {users.length > 0 ? (
                    users.map((user) => (
                        <li key={user.id}>
                            <strong>{user.fullName}</strong>
                            {user.age ? ` (${user.age} лет)` : ''} —
                            {user.gender === 'male' ? ' 👨' : user.gender === 'female' ? ' 👩' : ' 👤'}
                            <br />
                            <small style={{ color: 'gray' }}>Зарегистрированы: {new Date(user.createdAt).toLocaleString()}</small>
                        </li>
                    ))
                ) : (
                    <p>Загрузка данных...</p>
                )}
            </ul>
        </div>
    );
}

export default App;