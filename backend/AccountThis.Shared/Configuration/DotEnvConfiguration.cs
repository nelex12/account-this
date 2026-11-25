using Microsoft.Extensions.Configuration;

namespace AccountThis.Shared.Configuration;

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

            var key = line[..separator].Trim().Replace("__", ":");

            if (configuration[key] is null)
            {
                values[key] = ParseValue(line[(separator + 1)..].Trim());
            }
        }

        configuration.AddInMemoryCollection(values);
    }

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
