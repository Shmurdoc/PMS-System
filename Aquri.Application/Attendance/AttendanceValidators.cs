using FluentValidation;

namespace Aquri.Application.Attendance
{
    /// <summary>
    /// Shape checks for attendance creation — status vocabulary stays in the handler,
    /// which owns AttendanceRecord.ValidStatuses.
    /// </summary>
    public class CreateAttendanceCommandValidator : AbstractValidator<CreateAttendanceCommand>
    {
        public CreateAttendanceCommandValidator()
        {
            RuleFor(x => x.PropertyId).GreaterThan(0).WithMessage("PropertyId must be positive.");
            RuleFor(x => x.UserId).GreaterThan(0).WithMessage("UserId must be positive.");
            RuleFor(x => x.UserName).NotEmpty().WithMessage("UserName cannot be null or empty.");
        }
    }

    // UpdateAttendanceCommand carries only optional fields, so no validator.
}
