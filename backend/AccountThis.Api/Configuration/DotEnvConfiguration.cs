namespace AccountThis.Api.Configuration;

// Общий файл секретов .env в корне репозитория — тот же, что читает docker compose.
// Подключается только при локальном запуске (IDE, dotnet run): в Docker файла внутри контейнера нет,
// переменные передаёт docker-compose.yml.
public static class DotEnvConfiguration
{
    public static void AddDotEnvFile(this ConfigurationManager configuration, string startDirectory)
    {
        var path = FindDotEnv(startDirectory);
        if (path is null)
        {
            return;
        }

        var values = new Dictionary<string, string?>();
        foreach (var rawLine in File.ReadAllLines(path))
        {
            var line = rawLine.Trim();
            if (line.Length == 0 || line.StartsWith('#'))
            {
                continue;
            }

            var separator = line.IndexOf('=');
            if (separator <= 0)
            {
                continue;
            }

            // Как и у переменных окружения, "__" в имени — разделитель секций (ConnectionStrings__Default)
            var key = line[..separator].Trim().Replace("__", ":");

            // Настоящие переменные окружения важнее .env — так же поступает docker compose
            if (configuration[key] is null)
            {
                values[key] = ParseValue(line[(separator + 1)..].Trim());
            }
        }

        configuration.AddInMemoryCollection(values);
    }

    // .env ищется рядом с docker-compose.yml, вверх от каталога проекта (backend/AccountThis.Api → корень репозитория).
    // Поиск по docker-compose.yml, а не по самому .env, — чтобы не подхватить посторонний .env выше по дереву.
    private static string? FindDotEnv(string startDirectory)
    {
        for (var dir = new DirectoryInfo(startDirectory); dir is not null; dir = dir.Parent)
        {
            if (File.Exists(Path.Combine(dir.FullName, "docker-compose.yml")))
            {
                var path = Path.Combine(dir.FullName, ".env");
                return File.Exists(path) ? path : null;
            }
        }

        return null;
    }

    // Значение в кавычках берётся как есть; без кавычек — до комментария " #" (как в docker compose)
    private static string ParseValue(string value)
    {
        if (value.Length >= 2 && (value[0] == '"' || value[0] == '\'') && value[^1] == value[0])
        {
            return value[1..^1];
        }

        var comment = value.IndexOf(" #", StringComparison.Ordinal);
        return comment >= 0 ? value[..comment].TrimEnd() : value;
    }
}
