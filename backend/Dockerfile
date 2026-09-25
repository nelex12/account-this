# --- Стадия 1: сборка ---
# Тут стоит полный SDK (компилятор и т.д.), но этот образ в итоговый контейнер не попадёт
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Сначала копируем только csproj и восстанавливаем пакеты -
# так Docker закэширует этот шаг, и при изменении только кода пересборка будет быстрее
COPY AccountThis.Api/AccountThis.Api.csproj AccountThis.Api/
RUN dotnet restore AccountThis.Api/AccountThis.Api.csproj

# Теперь копируем весь остальной код и собираем
COPY AccountThis.Api/ AccountThis.Api/
WORKDIR /src/AccountThis.Api
RUN dotnet publish -c Release -o /app/publish --no-restore

# --- Стадия 2: рантайм ---
# Лёгкий образ, тут нет компилятора - только то, что нужно чтобы ЗАПУСТИТЬ приложение
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

EXPOSE 8080
ENTRYPOINT ["dotnet", "AccountThis.Api.dll"]
