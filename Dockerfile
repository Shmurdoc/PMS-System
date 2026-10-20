# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy csproj files first (layer caching)
COPY Aquri.Domain/Aquri.Domain.csproj Aquri.Domain/
COPY Aquri.Application/Aquri.Application.csproj Aquri.Application/
COPY Aquri.Infrastructure/Aquri.Infrastructure.csproj Aquri.Infrastructure/
COPY Aquri.API/Aquri.API.csproj Aquri.API/
RUN dotnet restore Aquri.API/Aquri.API.csproj

# Copy full source and build
COPY . .
RUN dotnet publish Aquri.API/Aquri.API.csproj -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

# curl is only here for the healthcheck below — the aspnet runtime image ships neither curl nor wget
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Non-root user
RUN adduser --disabled-password --gecos "" --uid 10001 appuser && \
    chown -R appuser:appuser /app
USER appuser

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl --fail --silent http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "Aquri.API.dll"]
