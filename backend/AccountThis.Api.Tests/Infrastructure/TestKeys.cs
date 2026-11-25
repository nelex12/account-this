using Microsoft.Extensions.Configuration;

namespace AccountThis.Api.Tests.Infrastructure;

public static class TestKeys
{
    public const string ServerPrivateKey = "nWGxne_9WmC6hEr0kuwsxERJxWl7MmkZcDusAxyuf2A";

    public const string ServerPublicKey = "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo";

    public const string SignatureOfEmptyMessage =
        "5VZDAMNgrHKQhuLMgG6CioSHfx645dl02HPgZSJJAVVfuIIVkKM7rMYeOXAc-bRr0lv18FlbviRlUUFDjnoQCw";

    public const string SignatureOfTokenAbc =
        "0t8e2xT57IZLHZo_NE6W6WEjCbhHR5TK6j3BDck8wbqqGrLZqvYItaKAfb2IiCG3D-veZidrqIYo37EFTmwvAg";

    public const string JwtSigningKey = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8";

    public static IConfiguration Configuration(string serverPrivateKey = ServerPrivateKey) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["SERVER_SIGNING_KEY"] = serverPrivateKey,
                ["JWT_SIGNING_KEY"] = JwtSigningKey,
            })
            .Build();
}
