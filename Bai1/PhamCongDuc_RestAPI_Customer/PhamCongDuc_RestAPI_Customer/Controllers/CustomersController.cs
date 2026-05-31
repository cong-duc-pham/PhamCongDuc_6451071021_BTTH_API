using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PhamCongDuc_RestAPI_Customer.Data;
using PhamCongDuc_RestAPI_Customer.Models;

namespace PhamCongDuc_RestAPI_Customer.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CustomersController : ControllerBase
    {
        private readonly AppDbContext _context;

        public CustomersController(AppDbContext context)
        {
            _context = context;
        }

        // GET /api/customers?page=1&pageSize=10
        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] int page = 1, [FromQuery] int pageSize = 10)
        {
            var total = await _context.Customers.CountAsync();
            var customers = await _context.Customers
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return Ok(new { total, page, pageSize, data = customers });
        }

        // GET /api/customers/5
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var customer = await _context.Customers.FindAsync(id);
            if (customer == null)
                return NotFound(new { message = $"Không tìm thấy khách hàng với id = {id}" });

            return Ok(customer);
        }

        // POST /api/customers
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] Customer customer)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            // Kiểm tra email trùng
            bool emailExists = await _context.Customers.AnyAsync(c => c.Email == customer.Email);
            if (emailExists)
                return Conflict(new { message = "Email đã tồn tại" });

            _context.Customers.Add(customer);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetById), new { id = customer.Id }, customer);
        }

        // PUT /api/customers/5
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] Customer customer)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var existing = await _context.Customers.FindAsync(id);
            if (existing == null)
                return NotFound(new { message = $"Không tìm thấy khách hàng với id = {id}" });

            // Kiểm tra email trùng với người khác
            bool emailExists = await _context.Customers
                .AnyAsync(c => c.Email == customer.Email && c.Id != id);
            if (emailExists)
                return Conflict(new { message = "Email đã tồn tại" });

            existing.Name = customer.Name;
            existing.Email = customer.Email;
            existing.Phone = customer.Phone;
            existing.Address = customer.Address;

            await _context.SaveChangesAsync();
            return Ok(existing);
        }

        // DELETE /api/customers/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var customer = await _context.Customers.FindAsync(id);
            if (customer == null)
                return NotFound(new { message = $"Không tìm thấy khách hàng với id = {id}" });

            _context.Customers.Remove(customer);
            await _context.SaveChangesAsync();

            return Ok(new { message = $"Đã xóa khách hàng id = {id}" });
        }
    }
}