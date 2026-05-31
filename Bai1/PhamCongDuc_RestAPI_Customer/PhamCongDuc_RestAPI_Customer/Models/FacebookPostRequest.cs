using System.ComponentModel.DataAnnotations;

namespace PhamCongDuc_RestAPI_Customer.Models
{
    public class FacebookPostRequest
    {
        [Required(ErrorMessage = "Noi dung bai viet khong duoc de trong")]
        public string Message { get; set; } = "";
    }
}
