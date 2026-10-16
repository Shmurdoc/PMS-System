using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Guests
{
    public record UpdateGuestCommand(
        int Id,
        string Name,
        string Phone,
        string Nationality,
        string? Address,
        string? EmergencyContact,
        string? EmergencyPhone,
        string Notes,
        string? VipLevel) : IRequest<Result<GuestDto>>;

    public class UpdateGuestHandler : IRequestHandler<UpdateGuestCommand, Result<GuestDto>>
    {
        private readonly IApplicationDbContext _context;

        public UpdateGuestHandler(IApplicationDbContext context) => _context = context;

        public async Task<Result<GuestDto>> Handle(UpdateGuestCommand request, CancellationToken cancellationToken)
        {
            var guest = await _context.Guests
                .FirstOrDefaultAsync(g => g.Id == request.Id, cancellationToken);

            if (guest is null)
                return Result<GuestDto>.NotFoundResult();

            try
            {
                guest.UpdateProfile(request.Name, request.Phone, request.Nationality,
                    request.Address, request.EmergencyContact, request.EmergencyPhone, request.Notes);

                if (!string.IsNullOrWhiteSpace(request.VipLevel))
                    guest.SetVipLevel(request.VipLevel);

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
