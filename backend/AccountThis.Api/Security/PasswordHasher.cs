namespace AccountThis.Api.Security;

// Хеш хранится в users.password_hash вместе с солью и параметрами алгоритма
public interface IPasswordHasher
{
    string Hash(string password);

    bool Verify(string password, string passwordHash);
}

public class PasswordHasher : IPasswordHasher
{
    public string Hash(string password)
    {
        throw new NotImplementedException();
    }

    public bool Verify(string password, string passwordHash)
    {
        throw new NotImplementedException();
    }
}
