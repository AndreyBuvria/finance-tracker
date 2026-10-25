using FinanceTracker.Application.Categories;
using Microsoft.AspNetCore.Mvc;

namespace FinanceTracker.Api.Controllers;

[Route("api/categories")]
public sealed class CategoriesController(CategoryService categoryService) : ApiControllerBase
{
    /// <summary>The user's categories with usage counts, optionally of one type; archived ones only on request.</summary>
    [HttpGet]
    [ProducesResponseType<CategoryListResponse>(StatusCodes.Status200OK)]
    [ProducesValidationProblem]
    [ProducesProblem(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<CategoryListResponse>> ListAsync(
        [FromQuery] CategoryListQuery query,
        CancellationToken cancellationToken)
    {
        var result = await categoryService.ListAsync(CurrentUserId, query, cancellationToken);
        return result.IsSuccess ? Ok(result.Value) : ErrorResult(result.Error);
    }

    /// <summary>The most used active categories of the last 90 days, padded with the defaults (quick-add grid).</summary>
    [HttpGet("top")]
    [ProducesResponseType<CategoryListResponse>(StatusCodes.Status200OK)]
    [ProducesValidationProblem]
    [ProducesProblem(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<CategoryListResponse>> ListTopAsync(
        [FromQuery] TopCategoriesQuery query,
        CancellationToken cancellationToken)
    {
        var result = await categoryService.ListTopAsync(CurrentUserId, query, cancellationToken);
        return result.IsSuccess ? Ok(result.Value) : ErrorResult(result.Error);
    }

    [HttpPost]
    [ProducesResponseType<CategoryResponse>(StatusCodes.Status201Created)]
    [ProducesValidationProblem]
    [ProducesProblem(StatusCodes.Status401Unauthorized)]
    [ProducesProblem(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CategoryResponse>> CreateAsync(
        CategoryRequest request,
        CancellationToken cancellationToken)
    {
        var result = await categoryService.CreateAsync(CurrentUserId, request, cancellationToken);
        return result.IsSuccess ? StatusCode(StatusCodes.Status201Created, result.Value) : ErrorResult(result.Error);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType<CategoryResponse>(StatusCodes.Status200OK)]
    [ProducesValidationProblem]
    [ProducesProblem(StatusCodes.Status401Unauthorized)]
    [ProducesProblem(StatusCodes.Status404NotFound)]
    [ProducesProblem(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CategoryResponse>> UpdateAsync(
        Guid id,
        CategoryRequest request,
        CancellationToken cancellationToken)
    {
        var result = await categoryService.UpdateAsync(CurrentUserId, id, request, cancellationToken);
        return result.IsSuccess ? Ok(result.Value) : ErrorResult(result.Error);
    }

    /// <summary>Hard-deletes a custom category without transactions, with its budgets, rules and alerts.</summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesProblem(StatusCodes.Status401Unauthorized)]
    [ProducesProblem(StatusCodes.Status404NotFound)]
    [ProducesProblem(StatusCodes.Status409Conflict)]
    public async Task<ActionResult> DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var result = await categoryService.DeleteAsync(CurrentUserId, id, cancellationToken);
        return result.IsSuccess ? NoContent() : ErrorResult(result.Error);
    }

    /// <summary>Hides the category from pickers; its history stays.</summary>
    [HttpPost("{id:guid}/archive")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesProblem(StatusCodes.Status401Unauthorized)]
    [ProducesProblem(StatusCodes.Status404NotFound)]
    [ProducesProblem(StatusCodes.Status409Conflict)]
    public async Task<ActionResult> ArchiveAsync(Guid id, CancellationToken cancellationToken)
    {
        var result = await categoryService.ArchiveAsync(CurrentUserId, id, cancellationToken);
        return result.IsSuccess ? NoContent() : ErrorResult(result.Error);
    }

    [HttpPost("{id:guid}/restore")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesProblem(StatusCodes.Status401Unauthorized)]
    [ProducesProblem(StatusCodes.Status404NotFound)]
    [ProducesProblem(StatusCodes.Status409Conflict)]
    public async Task<ActionResult> RestoreAsync(Guid id, CancellationToken cancellationToken)
    {
        var result = await categoryService.RestoreAsync(CurrentUserId, id, cancellationToken);
        return result.IsSuccess ? NoContent() : ErrorResult(result.Error);
    }

    /// <summary>Moves everything of this category into the target category, then archives this one.</summary>
    [HttpPost("{id:guid}/merge")]
    [ProducesResponseType<MergeCategoryResponse>(StatusCodes.Status200OK)]
    [ProducesValidationProblem]
    [ProducesProblem(StatusCodes.Status401Unauthorized)]
    [ProducesProblem(StatusCodes.Status404NotFound)]
    [ProducesProblem(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<MergeCategoryResponse>> MergeAsync(
        Guid id,
        MergeCategoryRequest request,
        CancellationToken cancellationToken)
    {
        var result = await categoryService.MergeAsync(CurrentUserId, id, request, cancellationToken);
        return result.IsSuccess ? Ok(result.Value) : ErrorResult(result.Error);
    }
}
