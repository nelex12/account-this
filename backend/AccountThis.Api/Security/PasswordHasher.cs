using System.Text;
using System.Security.Cryptography;
using Konscious.Security.Cryptography;

namespace AccountThis.Api.Security;

public interface IPasswordHasher
{
    string Hash(string password);

    bool Verify(string password, string passwordHash);
}

public class PasswordHasher : IPasswordHasher
{
    // Текущие параметры основаны на рекомендациях OWASP
    private const int Version = 19; // версия алгоритма Argon2
    private const int DegreeOfParallelism = 1; // количество потоков
    private const int MemorySize = 19456; // в КиБ, а не в байтах: 19456 КиБ = 19 МБ
    private const int Iterations = 3;

    /// <summary>Хеш пароля в формате PHC.</summary>
    public string Hash(string password)
    {
        if (password.Length == 0)
        {
            throw new ArgumentException("Password cannot be empty");
        }

        byte[] salt = RandomNumberGenerator.GetBytes(16); // 16 байт соли

        using var argon2 = new Argon2id(Encoding.UTF8.GetBytes(password))
        {
            Salt = salt,
            DegreeOfParallelism = DegreeOfParallelism, // количество потоков
            MemorySize = MemorySize, // в КиБ, а не в байтах: 19456 КиБ = 19 МБ
            Iterations = Iterations // количество итераций
        };

        byte[] hash = argon2.GetBytes(32); // 32 байта хеша
        string stringHash = Convert.ToBase64String(hash);
        string stringSalt = Convert.ToBase64String(salt);

        // Стандартный PHC-формат
        return $"$argon2id$v={Version}$m={MemorySize},t={Iterations},p={DegreeOfParallelism}${stringSalt}${stringHash}";
    }

    /// <summary>Проверка пароля.</summary>
    public bool Verify(string password, string passwordHash)
    {
        if (password.Length == 0)
        {
            return false; // пустой пароль не может быть верным
        }

        string[] parsedString = passwordHash.Split("$");

        string[] paramsArray = parsedString[3].Split(",");

        int parsedMemorySize = Convert.ToInt32(paramsArray[0].Replace("m=", ""));
        int parsedIterations = Convert.ToInt32(paramsArray[1].Replace("t=", ""));
        int parsedDegreeOfParallelism = Convert.ToInt32(paramsArray[2].Replace("p=", ""));

        byte[] salt = Convert.FromBase64String(parsedString[4]);
        byte[] parsedRealHash = Convert.FromBase64String(parsedString[5]);

        using var argon2 = new Argon2id(Encoding.UTF8.GetBytes(password))
        {
            Salt = salt,
            DegreeOfParallelism = parsedDegreeOfParallelism,
            MemorySize = parsedMemorySize,
            Iterations = parsedIterations
        };

        byte[] currentHash = argon2.GetBytes(32);

        return CryptographicOperations.FixedTimeEquals(currentHash, parsedRealHash);
    }
}
