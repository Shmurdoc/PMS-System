using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using MediatR;

namespace Aquri.Application.Guests
{
    /// <summary>Registers a new guest in the system.</summary>
    public record CreateGuestCommand(
        string Name,
        string Email,
        string Phone,
        string IdNumber,
        string Nationality) : IRequest<Result<GuestDto>>;

    public class CreateGuestHandler : IRequestHandler<CreateGuestCommand, Result<GuestDto>>
    {
        private readonly IApplicationDbContext _context;

        public CreateGuestHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<GuestDto>> Handle(CreateGuestCommand request, CancellationToken cancellationToken)
        {
            try
            {
                var guest = new Guest(request.Name, request.Email, request.Phone, request.IdNumber, request.Nationality);
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
