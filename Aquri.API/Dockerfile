FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS base
WORKDIR /app
EXPOSE 80
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS build
WORKDIR /src
COPY ["Aquri.API/Aquri.API.csproj", "Aquri.API/"]
RUN dotnet restore "Aquri.API/Aquri.API.csproj"
COPY . .
WORKDIR /src/Aquri.API
RUN dotnet build "Aquri.API.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "Aquri.API.csproj" -c Release -o /app/publish /p:PublishSingleFile=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Aquri.API.dll"]