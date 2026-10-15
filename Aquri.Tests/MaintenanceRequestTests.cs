using Xunit;
using Aquri.Domain.Entities;

namespace Aquri.Tests
{
    public class MaintenanceRequest_Should
    {
        [Fact]
        public void Be_Creatable_With_Description_and_PropertyId()
        {
            var request = new MaintenanceRequest("Fix leak", 1);
            Assert.NotNull(request);
            Assert.Equal("Fix leak", request.Description);
            Assert.Equal(1, request.PropertyId);
            Assert.Equal(0, request.Id); // DB-generated
        }

        [Fact]
        public void Have_Default_Values_When_Created_Without_Args()
        {
            var request = new MaintenanceRequest();
            Assert.Equal(0, request.Id);
            Assert.Equal(0, request.PropertyId);
            Assert.Equal(string.Empty, request.Description);
        }

        [Fact]
        public void Be_Invalid_When_Description_Is_Empty()
        {
            var request = new MaintenanceRequest(string.Empty, 1);
            Assert.False(request.IsValid());
        }

        [Fact]
        public void Be_Valid_When_Description_and_PropertyId_Are_Set()
        {
            var request = new MaintenanceRequest("Fix broken window", 1);
            Assert.True(request.IsValid());
        }
    }
}