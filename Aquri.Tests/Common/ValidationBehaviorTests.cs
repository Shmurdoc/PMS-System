using System.Threading;
using System.Threading.Tasks;
using Aquri.Application.Common;
using Aquri.Application.Common.Behaviors;
using FluentAssertions;
using FluentValidation;
using MediatR;
using Xunit;

namespace Aquri.Tests.Common
{
    /// <summary>
    /// FluentValidation pipeline behavior: validators registered for a request
    /// run before the handler. Failures on Result-returning responses come back
    /// as Result.Failure (the shape controllers already surface); requests with
    /// no validator pass through untouched.
    /// </summary>
    public class ValidationBehaviorTests
    {
        private sealed record SampleRequest(string? Name, string? Email) : IRequest<Result<SampleDto>>;

        private sealed record BareRequest(string? Name) : IRequest<string>;

        private sealed class SampleDto
        {
            public string Value { get; init; } = string.Empty;
        }

        private static IValidator<SampleRequest> NameAndEmailValidator()
        {
            var validator = new InlineValidator<SampleRequest>();
            validator.RuleFor(x => x.Name).NotEmpty().WithMessage("Name cannot be empty.");
            validator.RuleFor(x => x.Email).NotEmpty().WithMessage("Email cannot be empty.");
            return validator;
        }

        private static Task<Result<SampleDto>> PassResult() =>
            Task.FromResult(Result<SampleDto>.SuccessResult(new SampleDto { Value = "ok" }));

        [Fact]
        public async Task Request_Without_A_Validator_Passes_Through()
        {
            var behavior = new ValidationBehavior<SampleRequest, Result<SampleDto>>(
                Array.Empty<IValidator<SampleRequest>>());

            var result = await behavior.Handle(
                new SampleRequest(null, null), PassResult, CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data!.Value.Should().Be("ok");
        }

        [Fact]
        public async Task Failing_Validator_Returns_Result_Failure_And_Skips_Handler()
        {
            var handlerRan = false;
            var behavior = new ValidationBehavior<SampleRequest, Result<SampleDto>>(
                new[] { NameAndEmailValidator() });

            var result = await behavior.Handle(
                new SampleRequest("", ""),
                () => { handlerRan = true; return PassResult(); },
                CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Be("Name cannot be empty.; Email cannot be empty.");
            handlerRan.Should().BeFalse();
        }

        [Fact]
        public async Task Passing_Validator_Reaches_The_Handler()
        {
            var behavior = new ValidationBehavior<SampleRequest, Result<SampleDto>>(
                new[] { NameAndEmailValidator() });

            var result = await behavior.Handle(
                new SampleRequest("Ada", "ada@example.com"), PassResult, CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data!.Value.Should().Be("ok");
        }

        [Fact]
        public async Task Duplicate_Messages_Are_Joined_Once()
        {
            var first = new InlineValidator<SampleRequest>();
            first.RuleFor(x => x.Name).NotEmpty().WithMessage("Name cannot be empty.");
            var second = new InlineValidator<SampleRequest>();
            second.RuleFor(x => x.Name).NotNull().WithMessage("Name cannot be empty.");

            var behavior = new ValidationBehavior<SampleRequest, Result<SampleDto>>(
                new[] { first, second });

            var result = await behavior.Handle(
                new SampleRequest(null, "ada@example.com"), PassResult, CancellationToken.None);

            result.Success.Should().BeFalse();
            result.Error.Should().Be("Name cannot be empty.");
        }

        [Fact]
        public async Task Failing_Validator_On_A_Bare_Response_Throws_ValidationException()
        {
            var validator = new InlineValidator<BareRequest>();
            validator.RuleFor(x => x.Name).NotEmpty().WithMessage("Name cannot be empty.");

            var behavior = new ValidationBehavior<BareRequest, string>(new[] { validator });

            var act = () => behavior.Handle(
                new BareRequest(null), () => Task.FromResult("passed"), CancellationToken.None);

            var ex = await act.Should().ThrowAsync<ValidationException>();
            ex.Which.Errors.Should().ContainSingle(f => f.ErrorMessage == "Name cannot be empty.");
        }

        [Fact]
        public async Task Non_Result_Response_With_No_Validator_Passes_Through()
        {
            var behavior = new ValidationBehavior<BareRequest, string>(
                Array.Empty<IValidator<BareRequest>>());

            var result = await behavior.Handle(
                new BareRequest(null), () => Task.FromResult("passed"), CancellationToken.None);

            result.Should().Be("passed");
        }
    }
}
