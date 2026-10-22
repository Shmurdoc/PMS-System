using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using MediatR;

namespace Aquri.Application.Guests
{
    /// <summary>Registers a new guest. PropertyId is usually left out: the handler takes it from the signed-in user. An admin has to supply one.</summary>
    public record CreateGuestCommand(
        string Name,
        string Email,
        string Phone,
        string IdNumber,
        string Nationality,
        int? PropertyId = null) : IRequest<Result<GuestDto>>;

    public class CreateGuestHandler : IRequestHandler<CreateGuestCommand, Result<GuestDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser? _currentUser;

        public CreateGuestHandler(IApplicationDbContext context, ICurrentUser? currentUser = null)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result<GuestDto>> Handle(CreateGuestCommand request, CancellationToken cancellationToken)
        {
            var propertyId = request.PropertyId ?? _currentUser?.PropertyId;
            if (propertyId is null)
                return Result<GuestDto>.Failure("PropertyId is required.");

            try
            {
                var guest = new Guest(request.Name, request.Email, request.Phone, request.IdNumber, request.Nationality);
                guest.AssignProperty(propertyId.Value);
                _context.Guests.Add(guest);
                await _context.SaveChangesAsync(cancellationToken);

                return Result<GuestDto>.SuccessResult(GuestDto.FromEntity(guest));
            }
            catch (ArgumentException ex)
            {
                return Result<GuestDto>.Failure(ex.Message);
            }
        }
    }
}
