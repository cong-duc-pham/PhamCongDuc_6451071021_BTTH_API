namespace PhamCongDuc_RestAPI_Customer.Models
{
    public class FacebookOptions
    {
        public string GraphBaseUrl { get; set; } = "https://graph.facebook.com/v20.0";
        public string PageId { get; set; } = "";
        public string PageAccessToken { get; set; } = "";
        public string AdminToken { get; set; } = "local_admin_token";
        public int RetryCount { get; set; } = 2;
    }
}
