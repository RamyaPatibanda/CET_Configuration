using System.Text;
using api.BusinessLogic.Auth;
using api.BusinessLogic.FieldConfiguration;
using api.BusinessLogic.RuleConfiguration;
using api.BusinessLogic.UserManagement;
using api.DataAccess;
using api.DataAccess.FieldConfiguration;
using api.DataAccess.RuleConfiguration;
using api.DataAccess.Allocation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using api.Services.Allocation;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddMemoryCache();

builder.Services.AddScoped<CETDataAccess>();

builder.Services.AddScoped<IAuthBL, AuthBL>();
builder.Services.AddScoped<IUserManagementBL, UserManagementBL>();

builder.Services.AddScoped<IFieldConfigurationDAL, FieldConfigurationDAL>();
builder.Services.AddScoped<IFieldConfigurationBL, FieldConfigurationBL>();

builder.Services.AddScoped<IRuleConfigurationDAL, RuleConfigurationDAL>();
builder.Services.AddScoped<IRuleConfigurationBL, RuleConfigurationBL>();
builder.Services.AddScoped<AllocationRunHistoryDAL>();
builder.Services.AddScoped<IRuleEvaluator, RuleEvaluator>();
builder.Services.AddScoped<LegacyAllocationDAL>();
builder.Services.AddScoped<Step0CandidateRepository>();

builder.Services.AddAuthorization();
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://localhost:5174")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var jwtSecret = builder.Configuration["JwtSettings:Secret"];
if (!string.IsNullOrWhiteSpace(jwtSecret))
{
    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
                ValidateIssuer = false,
                ValidateAudience = false,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromSeconds(30)
            };
        });
}

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
