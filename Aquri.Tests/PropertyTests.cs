using Xunit;
using Aquri.Domain.Entities;

namespace Aquri.Tests
{
    public class Property_Should
    {
        [Fact]
        public void Be_Creatable_With_Name_and_PropertyId()
        {
            var property = new Property("Test Property", 1);
            Assert.NotNull(property);
            Assert.Equal("Test Property", property.Name);
            Assert.Equal(1, property.PropertyId);
            // Id is database-generated, defaults to 0
        }

        [Fact]
        public void Have_Default_Values_When_Created_Without_Args()
        {
            var property = new Property();
            Assert.Equal(0, property.Id);
            Assert.Equal(0, property.PropertyId);
            Assert.Equal(string.Empty, property.Name);
            Assert.Null(property.Description);
        }

[Fact]
public void Be_Invalid_When_Name_Is_Empty()
{
    Assert.Throws<ArgumentException>(() => new Property(string.Empty, 1));
}

[Fact]
public void Be_Invalid_When_PropertyId_Is_Zero()
{
    Assert.Throws<ArgumentException>(() => new Property("Test", 0));
}

        [Fact]
        public void Be_Valid_When_Name_and_PropertyId_Are_Set()
        {
            var property = new Property("Valid Property", 1);
            Assert.True(property.IsValid());
        }
    }
}