using AutoMapper;
using Aquri.Application.DTOs;
using Aquri.Domain.Entities;
using Aquri.Domain.Enums;

namespace Aquri.Application.MappingProfiles
{
    /// <summary>
    /// AutoMapper profile for Domain → DTO mappings only.
    /// Entities are constructed via domain methods, never mapped into —
    /// so only one-way (entity → dto) maps exist.
    /// </summary>
    public class MappingProfile : Profile
    {
        public MappingProfile()
        {
            CreateMap<Property, PropertyDto>()
                .ForMember(d => d.Status, opt => opt.MapFrom(s => s.Status.ToWire()));

            CreateMap<Room, RoomDto>()
                .ForMember(d => d.Status, opt => opt.MapFrom(s => s.Status.ToWire()));
        }
    }
}
