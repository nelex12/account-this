using Microsoft.Extensions.Configuration;

namespace AccountThis.Api.Tests.Infrastructure;

// Ключи только для тестов. Ключ сервера — тестовый вектор 1 из RFC 8032 (раздел 7.1):
// по нему заранее известны публичный ключ и подписи, поэтому тесты проверяют точные байты, а не «что-то похожее».
// Этот же вектор использован в примере ServerKeyResponse в api.yaml.
public static class TestKeys
{
    // SERVER_SIGNING_KEY: 32-байтный seed, base64url без паддинга
    public const string ServerPrivateKey = "nWGxne_9WmC6hEr0kuwsxERJxWl7MmkZcDusAxyuf2A";

    public const string ServerPublicKey = "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo";

    // Подпись ключом сервера пустой строки (ровно так в RFC 8032)
    public const string SignatureOfEmptyMessage =
        "5VZDAMNgrHKQhuLMgG6CioSHfx645dl02HPgZSJJAVVfuIIVkKM7rMYeOXAc-bRr0lv18FlbviRlUUFDjnoQCw";

    // Подпись ключом сервера ASCII-строки "AT1-TOKEN.abc" (посчитана эталонной библиотекой)
    public const string SignatureOfTokenAbc =
        "0t8e2xT57IZLHZo_NE6W6WEjCbhHR5TK6j3BDck8wbqqGrLZqvYItaKAfb2IiCG3D-veZidrqIYo37EFTmwvAg";

    // JWT_SIGNING_KEY: байты 0..31, base64url без паддинга
    public const string JwtSigningKey = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8";

    // Конфигурация для сервисов, которые создаются в тестах напрямую, без приложения
    public static IConfiguration Configuration(string serverPrivateKey = ServerPrivateKey) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["SERVER_SIGNING_KEY"] = serverPrivateKey,
                ["JWT_SIGNING_KEY"] = JwtSigningKey,
            })
            .Build();
}
