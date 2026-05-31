using System.Text.Json;
using Microsoft.Extensions.Options;
using PhamCongDuc_RestAPI_Customer.Models;

namespace PhamCongDuc_RestAPI_Customer.Services
{
    public class FacebookGraphException : Exception
    {
        public FacebookGraphException(string message, int statusCode, JsonElement? error = null)
            : base(message)
        {
            StatusCode = statusCode;
            Error = error;
        }

        public int StatusCode { get; }
        public JsonElement? Error { get; }
        public bool Retryable => StatusCode == 408 || StatusCode == 429 || StatusCode >= 500;
    }

    public class FacebookGraphService
    {
        private readonly HttpClient _httpClient;
        private readonly FacebookOptions _options;
        private readonly ILogger<FacebookGraphService> _logger;

        public FacebookGraphService(
            HttpClient httpClient,
            IOptions<FacebookOptions> options,
            ILogger<FacebookGraphService> logger)
        {
            _httpClient = httpClient;
            _options = options.Value;
            _logger = logger;
        }

        public Task<JsonDocument> GetPostsAsync(int limit)
        {
            return SendAsync(HttpMethod.Get, $"{_options.PageId}/posts", new Dictionary<string, string>
            {
                ["fields"] = "id,message,created_time,permalink_url",
                ["limit"] = limit.ToString()
            });
        }

        public Task<JsonDocument> CreatePostAsync(string message)
        {
            return SendAsync(HttpMethod.Post, $"{_options.PageId}/feed", body: new Dictionary<string, string>
            {
                ["message"] = message
            });
        }

        public Task<JsonDocument> GetCommentsAsync(string postId, int limit)
        {
            return SendAsync(HttpMethod.Get, $"{postId}/comments", new Dictionary<string, string>
            {
                ["fields"] = "id,message,from,created_time",
                ["limit"] = limit.ToString()
            });
        }

        private async Task<JsonDocument> SendAsync(
            HttpMethod method,
            string path,
            Dictionary<string, string>? query = null,
            Dictionary<string, string>? body = null)
        {
            if (string.IsNullOrWhiteSpace(_options.PageAccessToken) || string.IsNullOrWhiteSpace(_options.PageId))
            {
                throw new FacebookGraphException("Chua cau hinh Facebook PageId hoac PageAccessToken", StatusCodes.Status401Unauthorized);
            }

            for (var attempt = 0; attempt <= _options.RetryCount; attempt++)
            {
                try
                {
                    return await SendOnceAsync(method, path, query, body);
                }
                catch (FacebookGraphException ex) when (ex.Retryable && attempt < _options.RetryCount)
                {
                    var delayMs = 500 * (int)Math.Pow(2, attempt);
                    _logger.LogWarning(ex, "Facebook API loi tam thoi. Thu lai sau {DelayMs}ms", delayMs);
                    await Task.Delay(delayMs);
                }
            }

            throw new InvalidOperationException("Khong the goi Facebook API");
        }

        private async Task<JsonDocument> SendOnceAsync(
            HttpMethod method,
            string path,
            Dictionary<string, string>? query,
            Dictionary<string, string>? body)
        {
            var builder = new UriBuilder($"{_options.GraphBaseUrl.TrimEnd('/')}/{path.TrimStart('/')}");
            var parameters = new Dictionary<string, string>(query ?? new Dictionary<string, string>())
            {
                ["access_token"] = _options.PageAccessToken
            };
            builder.Query = string.Join("&", parameters.Select(item =>
                $"{Uri.EscapeDataString(item.Key)}={Uri.EscapeDataString(item.Value)}"));

            using var request = new HttpRequestMessage(method, builder.Uri);
            if (body is not null)
            {
                request.Content = new FormUrlEncodedContent(body);
            }

            _logger.LogInformation("Gui request toi Facebook Graph API {Method} {Path}", method, path);
            using var response = await _httpClient.SendAsync(request);
            var payload = await response.Content.ReadAsStringAsync();
            var json = JsonDocument.Parse(string.IsNullOrWhiteSpace(payload) ? "{}" : payload);

            _logger.LogInformation("Facebook Graph API tra ve status {StatusCode} cho {Path}", (int)response.StatusCode, path);

            if (!response.IsSuccessStatusCode)
            {
                var error = json.RootElement.TryGetProperty("error", out var value) ? value : (JsonElement?)null;
                var message = error?.TryGetProperty("message", out var msg) == true ? msg.GetString() : "Facebook API error";
                throw new FacebookGraphException(message ?? "Facebook API error", (int)response.StatusCode, error);
            }

            return json;
        }
    }
}
