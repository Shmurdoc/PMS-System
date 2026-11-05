using System.Linq;
using Aquri.Application.Common.Interfaces;
using NetArchTest.Rules;
using Xunit;

namespace Aquri.Tests.Architecture;

/// <summary>Enforces the Clean Architecture layering rules defined in docs/architecture.md.</summary>
public class ArchitectureTests
{
    private const string DomainNamespace = "Aquri.Domain";
    private const string ApplicationNamespace = "Aquri.Application";
    private const string InfrastructureNamespace = "Aquri.Infrastructure";
    private const string ApiNamespace = "Aquri.API";

    [Fact]
    public void Domain_Should_Not_Reference_Any_Other_Layer()
    {
        var domainAssembly = typeof(Aquri.Domain.Entities.User).Assembly;

        var result = Types.InAssembly(domainAssembly)
            .ShouldNot()
            .HaveDependencyOn(ApplicationNamespace)
            .GetResult();
        result.IsSuccessful.Should().BeTrue();

        result = Types.InAssembly(domainAssembly)
            .ShouldNot()
            .HaveDependencyOn(InfrastructureNamespace)
            .GetResult();
        result.IsSuccessful.Should().BeTrue();

        result = Types.InAssembly(domainAssembly)
            .ShouldNot()
            .HaveDependencyOn(ApiNamespace)
            .GetResult();
        result.IsSuccessful.Should().BeTrue();
    }

    [Fact]
    public void Application_Should_Only_Reference_Domain()
    {
        var applicationAssembly = typeof(IApplicationDbContext).Assembly;

        var result = Types.InAssembly(applicationAssembly)
            .ShouldNot()
            .HaveDependencyOn(InfrastructureNamespace)
            .GetResult();
        result.IsSuccessful.Should().BeTrue();

        result = Types.InAssembly(applicationAssembly)
            .ShouldNot()
            .HaveDependencyOn(ApiNamespace)
            .GetResult();
        result.IsSuccessful.Should().BeTrue();
    }

    [Fact]
    public void Infrastructure_Should_Not_Reference_Api()
    {
        var infrastructureAssembly = typeof(Aquri.Infrastructure.Persistence.AquriDbContext).Assembly;

        var result = Types.InAssembly(infrastructureAssembly)
            .ShouldNot()
            .HaveDependencyOn(ApiNamespace)
            .GetResult();
        result.IsSuccessful.Should().BeTrue();
    }

    [Fact]
    public void Api_Should_Not_Reference_Domain_Directly()
    {
        var apiAssembly = typeof(Aquri.API.Controllers.AuthController).Assembly;

        var result = Types.InAssembly(apiAssembly)
            .ShouldNot()
            .HaveDependencyOn(DomainNamespace)
            .GetResult();
        result.IsSuccessful.Should().BeTrue();
    }

    [Fact]
    public void Controllers_Should_Not_Reference_DbContext_Directly()
    {
        var apiAssembly = typeof(Aquri.API.Controllers.AuthController).Assembly;

        var result = Types.InAssembly(apiAssembly)
            .That()
            .HaveNameEndingWith("Controller")
            .ShouldNot()
            .HaveDependencyOn("Microsoft.EntityFrameworkCore")
            .GetResult();
        result.IsSuccessful.Should().BeTrue();
    }
}
