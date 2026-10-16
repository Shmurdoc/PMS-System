using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Application.DTOs;
using AutoMapper;
using MediatR;

namespace Aquri.Application.Properties.Status
{
    /// <summary>Loads a property by primary key, updates its status, and persists. Returns NotFound (not an exception) when the property does not exist.</summary>
    public class UpdatePropertyStatusHandler : IRequestHandler<UpdatePropertyStatusCommand, Result<PropertyDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly IMapper _mapper;

        public UpdatePropertyStatusHandler(IApplicationDbContext context, IMapper mapper)
        {
            _context = context;
            _mapper = mapper;
        }

        public async Task<Result<PropertyDto>> Handle(UpdatePropertyStatusCommand request, CancellationToken cancellationToken)
        {
            var property = await _context.Properties
                .FindAsync(request.Id, cancellationToken);

            if (property == null)
            {
                return Result<PropertyDto>.NotFoundResult();
            }

            property.UpdateStatus(request.Status);
            await _context.SaveChangesAsync(cancellationToken);

            return Result<PropertyDto>.SuccessResult(_mapper.Map<PropertyDto>(property));
        }
    }
}
