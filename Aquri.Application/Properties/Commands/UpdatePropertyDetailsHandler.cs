using System;
using System.Threading;
using System.Threading.Tasks;
using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Application.DTOs;
using AutoMapper;
using MediatR;

namespace Aquri.Application.Properties.Commands
{
    /// <summary>Loads a property by primary key, applies the rename + detail updates through domain methods, and persists. Returns NotFound when the property does not exist and Failure when a domain invariant rejects the input.</summary>
    public class UpdatePropertyDetailsHandler : IRequestHandler<UpdatePropertyDetailsCommand, Result<PropertyDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly IMapper _mapper;
        private readonly ICurrentUser _currentUser;

        public UpdatePropertyDetailsHandler(IApplicationDbContext context, IMapper mapper, ICurrentUser currentUser)
        {
            _context = context;
            _mapper = mapper;
            _currentUser = currentUser;
        }

        public async Task<Result<PropertyDto>> Handle(UpdatePropertyDetailsCommand request, CancellationToken cancellationToken)
        {
            var property = await _context.Properties
                .FindAsync(request.Id, cancellationToken);

            if (property == null)
            {
                return Result<PropertyDto>.NotFoundResult();
            }

            try
            {
                var oldCurrency = property.Currency;
                var oldName = property.Name;

                property.Rename(request.Name);
                property.UpdateDetails(
                    request.Description,
                    request.Address,
                    request.Manager,
                    request.Rating,
                    request.Phone,
                    request.Email);

                if (!string.IsNullOrWhiteSpace(request.Currency) && request.Currency != oldCurrency)
                    property.SetCurrency(request.Currency);

                var changes = new List<string>();
                if (oldName != property.Name) changes.Add($"name: {oldName} → {property.Name}");
                if (oldCurrency != property.Currency) changes.Add($"currency: {oldCurrency} → {property.Currency}");
                var details = changes.Count > 0 ? string.Join("; ", changes) : "no field changes";
                AuditTrail.Write(_context, _currentUser, "update_property", "property", property.Id.ToString(), property.Name, null, details);
                await _context.SaveChangesAsync(cancellationToken);

                return Result<PropertyDto>.SuccessResult(_mapper.Map<PropertyDto>(property));
            }
            catch (ArgumentException ex)
            {
                return Result<PropertyDto>.Failure(ex.Message);
            }
        }
    }
}
