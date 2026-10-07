using System.Text;
using System.Security.Cryptography;
using Konscious.Security.Cryptography;
using System.Reflection.Metadata;

namespace AccountThis.Api.Security;



// Хеш хранится в users.password_hash вместе с солью и параметрами алгоритма
public interface IPasswordHasher
{
    string Hash(string password);

    bool Verify(string password, string passwordHash);
}

// TODO(human): реализовать Hash и Verify (тесты — AccountThis.Api.Tests/Security/PasswordHasherTests.cs)
public class PasswordHasher : IPasswordHasher
{
    // Текущие параметры основаны на рекомендациях OWASP
    private const int Version = 19; // версия алгоритма Argon2
    private const int DegreeOfParallelism = 4; // количество потоков
    private const int MemorySize = 19456; // в КиБ, а не в байтах: 19456 КиБ = 19 МБ
    private const int Iterations = 3;

    /// <summary>
    /// Генерирует хэш Argon2 для пароля с солью и возвращает строку с хэшем и параметрами
    /// </summary>
    /// <param name="password"></param>
    /// <returns></returns>
    public string Hash(string password)
    {
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

    public bool Verify(string password, string passwordHash)
    {
        string[] parsedString = passwordHash.Split("$");

        int parsedMemorySize = Convert.ToInt32(parsedString[3]);
        int parsedIterations = Convert.ToInt32(parsedString[4]);
        int parsedDegreeOfParallelism = Convert.ToInt32(parsedString[5]);
        byte[] salt = Convert.FromBase64String(parsedString[6]);
        byte[] parsedSavedHash = Convert.FromBase64String(parsedString[7]);





        using var argon2 = new Argon2id(Encoding.UTF8.GetBytes(password))
        {
            Salt = salt,
            DegreeOfParallelism = parsedDegreeOfParallelism,
            MemorySize = parsedMemorySize,
            Iterations = Iterations
        };

        byte[] hash = argon2.GetBytes(32); // 32 байта хеша
        string stringHash = Convert.ToBase64String(hash);
        string stringSalt = Convert.ToBase64String(salt);

    }
}
