using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PhamCongDuc_RestAPI_Customer.Models
{
    [Table("KhachHang")]
    public class Customer
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "Tên không được để trống")]
        [MaxLength(100)]
        public string Name { get; set; } = "";

        [Required(ErrorMessage = "Email không được để trống")]
        [EmailAddress(ErrorMessage = "Email không hợp lệ")]
        [MaxLength(100)]
        public string Email { get; set; } = "";

        [Phone(ErrorMessage = "Số điện thoại không hợp lệ")]
        [MaxLength(20)]
        public string? Phone { get; set; }

        [MaxLength(255)]
        public string? Address { get; set; }
    }
}