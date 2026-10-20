using System.Threading.Tasks;
using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Application.DTOs;
using Aquri.Application.Properties.Commands;
using Aquri.Infrastructure.Persistence;
using MediatR;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Aquri.Tests
{
    /// <summary>Boots the real API host and verifies the DbContext (the unit of work), the application abstraction over it, and MediatR handlers are all registered and resolvable from DI.</summary>
    public class DependencyInjectionTests
    {
        [Fact]
        public void ServiceProvider_Resolves_DbContext_And_App_Abstraction()
        {
            using var factory = new WebApplicationFactory<Program>();

            using var scope = factory.Services.CreateScope();
            var dbContext = scope.ServiceProvider.GetService<AquriDbContext>();
            var appContext = scope.ServiceProvider.GetService<IApplicationDbContext>();
            var mediator = scope.ServiceProvider.GetService<IMediator>();

            Assert.NotNull(dbContext);
            Assert.NotNull(appContext);
            Assert.NotNull(mediator);
        }

        [Fact]
        public void App_Abstraction_Is_Same_DbContext_Within_One_Scope()
        {
            using var factory = new WebApplicationFactory<Program>();

            using var scope = factory.Services.CreateScope();
            var appContext = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
            var secondAppContext = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
            var dbContext = scope.ServiceProvider.GetRequiredService<AquriDbContext>();

            // Same scope => same DbContext instance => one transaction across handlers
            Assert.Same(appContext, secondAppContext);
            Assert.Same(dbContext, appContext);
        }

        [Fact]
        public void MediatR_Resolves_CreatePropertyWithRoomsHandler_From_Di()
        {
            using var factory = new WebApplicationFactory<Program>();

            using var scope = factory.Services.CreateScope();
            var handler = scope.ServiceProvider
                .GetService<IRequestHandler<CreatePropertyWithRoomsCommand, Result<PropertyDto>>>();

            Assert.NotNull(handler);
        }

        [Fact]
        public async Task Api_Returns_Success_For_Health_Endpoint()
        {
            using var factory = new WebApplicationFactory<Program>();
            var client = factory.CreateClient();

            var response = await client.GetAsync("/health");

            Assert.True(response.IsSuccessStatusCode);
        }
    }
}
