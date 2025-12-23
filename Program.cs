using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;
using Microsoft.Extensions.FileProviders;
using System.IO;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSignalR();

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

// Ensure /media route serves physical files from wwwroot/media (helps with some static asset mappings)
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(Path.Combine(app.Environment.ContentRootPath, "wwwroot", "media")),
    RequestPath = "/media",
    ServeUnknownFileTypes = true
});

app.MapGet("/health", () => Results.Ok("ok"));

app.MapHub<SyncHub>("/sync");

app.Run();

// Minimal SyncHub defined below to keep project small
public class SyncHub : Microsoft.AspNetCore.SignalR.Hub
{
    public async Task PlaybackEvent(string action, double time)
    {
        await Clients.Others.SendAsync("Sync", action, time);
    }
}
