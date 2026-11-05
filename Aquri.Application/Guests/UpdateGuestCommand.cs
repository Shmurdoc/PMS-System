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
        private readonly ICurrentUser _currentUser;

        public UpdateGuestHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result<GuestDto>> Handle(UpdateGuestCommand request, CancellationToken cancellationToken)
        {
            var guest = await _context.Guests
                .FirstOrDefaultAsync(g => g.Id == request.Id, cancellationToken);

            if (guest is null)
                return Result<GuestDto>.NotFoundResult();

            try
            {
                var oldName = guest.Name;
                var oldPhone = guest.Phone;
                var oldNationality = guest.Nationality;
                var oldAddress = guest.Address;
                var oldEmergencyContact = guest.EmergencyContact;
                var oldEmergencyPhone = guest.EmergencyPhone;
                var oldNotes = guest.Notes;
                var oldVipLevel = guest.VipLevel;

                guest.UpdateProfile(request.Name, request.Phone, request.Nationality,
                    request.Address, request.EmergencyContact, request.EmergencyPhone, request.Notes);

                if (!string.IsNullOrWhiteSpace(request.VipLevel))
                    guest.SetVipLevel(request.VipLevel);

                var changes = new List<string>();
                if (oldName != guest.Name) changes.Add($"name: {oldName} → {guest.Name}");
                if (oldPhone != guest.Phone) changes.Add($"phone: {oldPhone} → {guest.Phone}");
                if (oldNationality != guest.Nationality) changes.Add($"nationality: {oldNationality} → {guest.Nationality}");
                if (oldAddress != guest.Address) changes.Add($"address: {oldAddress ?? "(none)"} → {guest.Address ?? "(none)"}");
                if (oldEmergencyContact != guest.EmergencyContact) changes.Add($"emergency contact: {oldEmergencyContact ?? "(none)"} → {guest.EmergencyContact ?? "(none)"}");
                if (oldEmergencyPhone != guest.EmergencyPhone) changes.Add($"emergency phone: {oldEmergencyPhone ?? "(none)"} → {guest.EmergencyPhone ?? "(none)"}");
                if (oldNotes != guest.Notes) changes.Add($"notes: {oldNotes ?? "(none)"} → {guest.Notes ?? "(none)"}");
                if (oldVipLevel != guest.VipLevel) changes.Add($"VIP level: {oldVipLevel ?? "(none)"} → {guest.VipLevel ?? "(none)"}");
                var details = changes.Count > 0 ? string.Join("; ", changes) : "no field changes";

                await _context.SaveChangesAsync(cancellationToken);
                AuditTrail.Write(_context, _currentUser, "update_guest", "guest", guest.Id.ToString(), guest.Name, null, details);
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
