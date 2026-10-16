using System;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Aquri.API.Common;
using Aquri.API.Middleware;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace Aquri.Tests.Api.Envelope
{
    /// <summary>Controllers surface handler failures as BadRequest("message") strings; the middleware must carry that text into error.message instead of the generic status default.</summary>
    public class ApiResponseMiddlewareMessageTests
    {
        private static async Task<JsonElement> RunWithBody(int statusCode, string body)
        {
            var middleware = new ApiResponseMiddleware(
                async ctx =>
                {
                    ctx.Response.StatusCode = statusCode;
                    var bytes = Encoding.UTF8.GetBytes(body);
                    await ctx.Response.Body.WriteAsync(bytes);
                },
                TimeProvider.System);

            var context = new DefaultHttpContext();
            context.Request.Path = "/api/v1/rfidtags";
            context.Response.Body = new MemoryStream();

            await middleware.InvokeAsync(context);

            context.Response.Body.Position = 0;
            using var doc = await JsonDocument.ParseAsync(context.Response.Body);
            return doc.RootElement.Clone();
        }

        [Fact]
        public async Task BadRequest_String_Surfaces_Handler_Message()
        {
            // MVC's StringOutputFormatter writes a bare BadRequest(string) as
            // raw text/plain — no JSON quotes around it.
            var envelope = await RunWithBody(StatusCodes.Status400BadRequest,
                "Tag is not a guest tag.");

            envelope.GetProperty("error").GetProperty("code").GetString()
                .Should().Be(ErrorCodes.Validation);
            envelope.GetProperty("error").GetProperty("message").GetString()
                .Should().Be("Tag is not a guest tag.");
        }

        [Fact]
        public async Task Plain_Text_Error_Body_With_Html_Falls_Back_To_Default()
        {
            var envelope = await RunWithBody(StatusCodes.Status400BadRequest,
                "<html><body>502 Bad Gateway</body></html>");

            envelope.GetProperty("error").GetProperty("code").GetString()
                .Should().Be(ErrorCodes.Validation);
            envelope.GetProperty("error").GetProperty("message").GetString()
                .Should().Be("The request was invalid.");
        }

        [Fact]
        public async Task Conflict_String_Surfaces_Handler_Message()
        {
            var envelope = await RunWithBody(StatusCodes.Status409Conflict,
                "\"Tag 'X' is already issued at this property.\"");

            envelope.GetProperty("error").GetProperty("code").GetString()
                .Should().Be(ErrorCodes.Conflict);
            envelope.GetProperty("error").GetProperty("message").GetString()
                .Should().Be("Tag 'X' is already issued at this property.");
        }

        [Fact]
        public async Task NotFound_With_Empty_Body_Falls_Back_To_Default()
        {
            var envelope = await RunWithBody(StatusCodes.Status404NotFound, "");

            envelope.GetProperty("error").GetProperty("code").GetString()
                .Should().Be(ErrorCodes.NotFound);
            envelope.GetProperty("error").GetProperty("message").GetString()
                .Should().Be("The requested resource was not found.");
        }
    }
}
