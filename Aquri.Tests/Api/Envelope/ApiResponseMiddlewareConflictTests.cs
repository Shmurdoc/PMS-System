using System;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using Aquri.API.Common;
using Aquri.API.Middleware;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Aquri.Tests.Api.Envelope
{
    /// <summary>
    /// ApiResponseMiddleware unit tests for paths the HTTP-level EnvelopeTests
    /// cannot reach on the InMemory provider (which does not enforce unique
    /// indexes): a DbUpdateException bubbling up from a handler must surface
    /// as an envelope-shaped 409 CONFLICT, never a raw 500.
    /// </summary>
    public class ApiResponseMiddlewareConflictTests
    {
        [Fact]
        public async Task DbUpdateException_Becomes_Enveloped_409_Conflict()
        {
            var middleware = new ApiResponseMiddleware(
                _ => throw new DbUpdateException("duplicate key value violates unique constraint", new Exception("IX_Tickets_TicketNumber")),
                TimeProvider.System);

            var context = new DefaultHttpContext
            {
                RequestServices = new ServiceCollection().BuildServiceProvider()
            };
            context.Request.Path = "/api/v1/tickets";
            context.Response.Body = new MemoryStream();

            await middleware.InvokeAsync(context);

            context.Response.StatusCode.Should().Be(StatusCodes.Status409Conflict);
            context.Response.ContentType.Should().Contain("application/json");

            context.Response.Body.Position = 0;
            using var envelope = await JsonDocument.ParseAsync(context.Response.Body);

            envelope.RootElement.GetProperty("success").GetBoolean().Should().BeFalse();
            envelope.RootElement.GetProperty("error").GetProperty("code").GetString().Should().Be(ErrorCodes.Conflict);
            envelope.RootElement.GetProperty("error").GetProperty("message").GetString().Should().NotBeNullOrWhiteSpace();
            envelope.RootElement.GetProperty("requestId").GetString().Should().NotBeNullOrWhiteSpace();
            envelope.RootElement.GetProperty("timestamp").GetString().Should().NotBeNullOrWhiteSpace();
        }

        [Fact]
        public async Task Other_Exceptions_Still_Become_Enveloped_500()
        {
            var middleware = new ApiResponseMiddleware(
                _ => throw new InvalidOperationException("boom"),
                TimeProvider.System);

            var context = new DefaultHttpContext
            {
                RequestServices = new ServiceCollection().BuildServiceProvider()
            };
            context.Request.Path = "/api/v1/tickets";
            context.Response.Body = new MemoryStream();

            await middleware.InvokeAsync(context);

            context.Response.StatusCode.Should().Be(StatusCodes.Status500InternalServerError);

            context.Response.Body.Position = 0;
            using var envelope = await JsonDocument.ParseAsync(context.Response.Body);

            envelope.RootElement.GetProperty("success").GetBoolean().Should().BeFalse();
            envelope.RootElement.GetProperty("error").GetProperty("code").GetString().Should().Be(ErrorCodes.Internal);
        }
    }
}
