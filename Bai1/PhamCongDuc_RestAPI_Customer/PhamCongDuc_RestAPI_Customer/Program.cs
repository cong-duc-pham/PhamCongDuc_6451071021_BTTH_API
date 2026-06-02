using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi;
using PhamCongDuc_RestAPI_Customer.Data;
using PhamCongDuc_RestAPI_Customer.Models;
using PhamCongDuc_RestAPI_Customer.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services.Configure<FacebookOptions>(builder.Configuration.GetSection("Facebook"));
builder.Services.AddHttpClient<FacebookGraphService>();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new()
    {
        Title = "PhamCongDuc - Facebook Page Backend API",
        Version = "v1"
    });

    c.AddSecurityDefinition("AdminToken", new OpenApiSecurityScheme
    {
        Description = "Nhap admin token. Vi du: local_admin_token",
        Name = "X-Admin-Token",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "AdminToken"
    });

    c.AddSecurityRequirement(document => new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecuritySchemeReference("AdminToken", document, null),
            new List<string>()
        }
    });
});

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Facebook Backend API v1");
    c.RoutePrefix = string.Empty;
});

app.Use(async (context, next) =>
{
    try
    {
        await next();
    }
    catch (FacebookGraphException ex)
    {
        context.Response.StatusCode = ex.StatusCode;
        context.Response.ContentType = "application/json; charset=utf-8";
        await context.Response.WriteAsJsonAsync(new
        {
            ok = false,
            error = new
            {
                code = ex.StatusCode == StatusCodes.Status401Unauthorized ? "unauthorized" : "facebook_api_error",
                message = ex.Message,
                retryable = ex.Retryable,
                detail = ex.Error
            }
        });
    }
});

app.UseAuthorization();
app.MapControllers();
app.Run();
