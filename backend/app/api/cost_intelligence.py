from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.db.database import get_db
from app.schemas.cost_intelligence import (
    DishCreate,
    DishUpdate,
    GenerateRecommendationsRequest,
    IngredientCreate,
    IngredientUpdate,
    InvoiceCreate,
    RecipeItemCreate,
    SimulatePriceChangeRequest,
    SupplierCreate,
    TicketApplyRequest,
    TicketScanRequest,
)
from app.services.cost_intelligence import (
    COST_DISH,
    COST_RECIPE_ITEM,
    COST_SUPPLIER,
    apply_ticket,
    create_cost_record,
    create_ingredient,
    create_invoice,
    delete_cost_record,
    delete_dish,
    delete_ingredient,
    dish_cost_breakdown,
    dish_price_advice,
    generate_recommendations,
    list_dishes,
    list_ingredients,
    list_recipe_items,
    list_suppliers,
    scan_ticket,
    simulate_price_change,
    update_dish,
    update_ingredient,
)


router = APIRouter(prefix="/cost-intelligence", tags=["cost-intelligence"])


def require_restaurant_id(current_user) -> str:
    if not current_user.restaurant_id:
        raise HTTPException(status_code=400, detail="El usuario no tiene restaurante asignado")
    return current_user.restaurant_id


@router.get("/ingredients")
def get_ingredients(db: Session = Depends(get_db), current_user=Depends(require_permission("cost_intelligence"))) -> list[dict]:
    return list_ingredients(db, require_restaurant_id(current_user))


@router.post("/ingredients")
def create_ingredient_endpoint(
    payload: IngredientCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("cost_intelligence")),
) -> dict:
    return create_ingredient(db, require_restaurant_id(current_user), payload.model_dump())


@router.patch("/ingredients/{ingredient_id}")
def update_ingredient_endpoint(
    ingredient_id: str,
    payload: IngredientUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("cost_intelligence")),
) -> dict:
    result = update_ingredient(
        db, require_restaurant_id(current_user), ingredient_id, payload.model_dump(exclude_unset=True)
    )
    if not result:
        raise HTTPException(status_code=404, detail="Ingrediente no encontrado")
    return result


@router.delete("/ingredients/{ingredient_id}")
def delete_ingredient_endpoint(
    ingredient_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("cost_intelligence")),
) -> dict:
    if not delete_ingredient(db, require_restaurant_id(current_user), ingredient_id):
        raise HTTPException(status_code=404, detail="Ingrediente no encontrado")
    return {"success": True, "id": ingredient_id}


@router.get("/suppliers")
def get_suppliers(db: Session = Depends(get_db), current_user=Depends(require_permission("cost_intelligence"))) -> list[dict]:
    return list_suppliers(db, require_restaurant_id(current_user))


@router.post("/suppliers")
def create_supplier(
    payload: SupplierCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("cost_intelligence")),
) -> dict:
    return create_cost_record(db, COST_SUPPLIER, require_restaurant_id(current_user), payload.model_dump())


@router.get("/dishes")
def get_dishes(db: Session = Depends(get_db), current_user=Depends(require_permission("cost_intelligence"))) -> list[dict]:
    return list_dishes(db, require_restaurant_id(current_user))


@router.post("/dishes")
def create_dish(
    payload: DishCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("cost_intelligence")),
) -> dict:
    return create_cost_record(db, COST_DISH, require_restaurant_id(current_user), payload.model_dump())


@router.patch("/dishes/{dish_id}")
def update_dish_endpoint(
    dish_id: str,
    payload: DishUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("cost_intelligence")),
) -> dict:
    result = update_dish(db, require_restaurant_id(current_user), dish_id, payload.model_dump(exclude_unset=True))
    if not result:
        raise HTTPException(status_code=404, detail="Plato no encontrado")
    return result


@router.delete("/dishes/{dish_id}")
def delete_dish_endpoint(
    dish_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("cost_intelligence")),
) -> dict:
    if not delete_dish(db, require_restaurant_id(current_user), dish_id):
        raise HTTPException(status_code=404, detail="Plato no encontrado")
    return {"success": True, "id": dish_id}


@router.get("/recipes")
def get_recipes(db: Session = Depends(get_db), current_user=Depends(require_permission("cost_intelligence"))) -> list[dict]:
    return list_recipe_items(db, require_restaurant_id(current_user))


@router.post("/recipes")
def create_recipe_item(
    payload: RecipeItemCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("cost_intelligence")),
) -> dict:
    return create_cost_record(db, COST_RECIPE_ITEM, require_restaurant_id(current_user), payload.model_dump())


@router.delete("/recipes/{recipe_id}")
def delete_recipe_endpoint(
    recipe_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("cost_intelligence")),
) -> dict:
    if not delete_cost_record(db, require_restaurant_id(current_user), COST_RECIPE_ITEM, recipe_id):
        raise HTTPException(status_code=404, detail="Linea de receta no encontrada")
    return {"success": True, "id": recipe_id}


@router.get("/dishes/{dish_id}/cost-breakdown")
def get_dish_cost_breakdown(
    dish_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("cost_intelligence")),
) -> dict:
    result = dish_cost_breakdown(db, require_restaurant_id(current_user), dish_id)
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("error") or "Plato no encontrado")
    return result


@router.get("/price-advice")
def get_price_advice(
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("cost_intelligence")),
) -> list[dict]:
    return dish_price_advice(db, require_restaurant_id(current_user))


@router.post("/invoices")
def post_invoice(
    payload: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("cost_intelligence")),
) -> dict:
    data = payload.model_dump()
    data["invoice_date"] = data["invoice_date"].isoformat()
    return create_invoice(db, require_restaurant_id(current_user), data)


@router.post("/recommendations/generate")
def post_recommendations(
    payload: GenerateRecommendationsRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("cost_intelligence")),
) -> list[dict]:
    return generate_recommendations(db, require_restaurant_id(current_user), payload.target_margin)


@router.post("/simulate-price-change")
def post_simulate_price_change(
    payload: SimulatePriceChangeRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("cost_intelligence")),
) -> dict:
    result = simulate_price_change(db, require_restaurant_id(current_user), payload.dish_id, payload.new_price)
    if result.get("success") is False:
        raise HTTPException(status_code=404, detail=result.get("error") or "Plato no encontrado")
    return result


@router.post("/ticket/scan")
def post_ticket_scan(
    payload: TicketScanRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("cost_intelligence")),
) -> dict:
    result = scan_ticket(
        db,
        require_restaurant_id(current_user),
        payload.image_base64,
        payload.mime_type,
        payload.note,
    )
    if not result.get("success"):
        raise HTTPException(status_code=422, detail=result.get("error") or "No se pudo leer el ticket")
    return result


@router.post("/ticket/apply")
def post_ticket_apply(
    payload: TicketApplyRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("cost_intelligence")),
) -> dict:
    if not payload.rows:
        raise HTTPException(status_code=400, detail="No hay lineas que aplicar")
    return apply_ticket(
        db,
        require_restaurant_id(current_user),
        payload.rows,
        payload.supplier,
        payload.date,
        payload.replenish_stock,
    )
