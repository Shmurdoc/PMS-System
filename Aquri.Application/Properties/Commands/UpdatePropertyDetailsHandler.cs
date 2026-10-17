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

        public UpdatePropertyDetailsHandler(IApplicationDbContext context, IMapper mapper)
        {
            _context = context;
            _mapper = mapper;
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
                property.Rename(request.Name);
                property.UpdateDetails(
                    request.Description,
                    request.Address,
                    request.Manager,
                    request.Rating,
                    request.Phone,
                    request.Email);
            }
            catch (ArgumentException ex)
            {
                return Result<PropertyDto>.Failure(ex.Message);
            }

            await _context.SaveChangesAsync(cancellationToken);

            return Result<PropertyDto>.SuccessResult(_mapper.Map<PropertyDto>(property));
        }
    }
}
