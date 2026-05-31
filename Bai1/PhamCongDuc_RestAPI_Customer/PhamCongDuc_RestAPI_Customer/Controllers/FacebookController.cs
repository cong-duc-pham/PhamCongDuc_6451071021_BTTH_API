using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using PhamCongDuc_RestAPI_Customer.Models;
using PhamCongDuc_RestAPI_Customer.Services;

namespace PhamCongDuc_RestAPI_Customer.Controllers
{
    [ApiController]
    [Route("")]
    public class FacebookController : ControllerBase
    {
        private readonly FacebookGraphService _facebook;
        private readonly FacebookOptions _options;

        public FacebookController(FacebookGraphService facebook, IOptions<FacebookOptions> options)
        {
            _facebook = facebook;
            _options = options.Value;
        }

        [HttpGet("posts")]
        public async Task<IActionResult> GetPosts([FromQuery] int limit = 25)
        {
            if (!IsAdmin()) return UnauthorizedResponse();
            var data = await _facebook.GetPostsAsync(limit);
            return Ok(ApiOk(data.RootElement.Clone()));
        }

        [HttpPost("post")]
        public async Task<IActionResult> CreatePost([FromBody] FacebookPostRequest request)
        {
            if (!IsAdmin()) return UnauthorizedResponse();
            if (!ModelState.IsValid) return BadRequest(ApiError("validation_error", "Du lieu khong hop le"));

            var data = await _facebook.CreatePostAsync(request.Message);
            return Created("", ApiOk(data.RootElement.Clone()));
        }

        [HttpGet("comments")]
        public async Task<IActionResult> GetComments([FromQuery] string postId, [FromQuery] int limit = 25)
        {
            if (!IsAdmin()) return UnauthorizedResponse();
            if (string.IsNullOrWhiteSpace(postId))
            {
                return BadRequest(ApiError("validation_error", "postId la bat buoc"));
            }

            var data = await _facebook.GetCommentsAsync(postId, limit);
            return Ok(ApiOk(data.RootElement.Clone()));
        }

        private bool IsAdmin()
        {
            return Request.Headers.TryGetValue("X-Admin-Token", out var token)
                && token.ToString() == _options.AdminToken;
        }

        private IActionResult UnauthorizedResponse()
        {
            return Unauthorized(ApiError("unauthorized", "Can gui header X-Admin-Token hop le"));
        }

        private static object ApiOk(object data)
        {
            return new { ok = true, data };
        }

        private static object ApiError(string code, string message, bool retryable = false, object? detail = null)
        {
            return new
            {
                ok = false,
                error = new { code, message, retryable, detail }
            };
        }
    }
}
