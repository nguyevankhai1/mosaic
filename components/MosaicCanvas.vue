<template>
	<canvas
		ref="canvasRef"
		:width="width"
		:height="height"
		:style="{ cursor: isPanning ? 'grabbing' : 'pointer' }"
		@click="clickedCanvas"
		@wheel="handleZoom"
		@mousedown="startPan"
		@mousemove="panCanvas"
		@mouseup="endPan"
		@mouseleave="endPan"
	/>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import Grid from "@/composables/models/Grid";
import { getMousePosition } from "@/composables/utils/helpers";
import { createTargetPicture } from "@/composables/utils/target";
import { updateSources } from "@/composables/utils/sources";
import ImageLoader from "@/composables/models/ImageLoader";

interface MosaicImageInfo {
	column: number;
	row: number;
	color: number;
	image: HTMLImageElement;
}

interface MosaicProps {
	width?: number;
	height?: number;
	columns?: number;
	rows?: number;
	colorBlending?: number;
	target: string | HTMLImageElement;
	sources: string[];
	crossOrigin?: string | null;
	onClick?: ((info: MosaicImageInfo) => void) | null;
	onLoadProgress?: ((progress: number) => void) | null;
}

// Props
const props = defineProps<MosaicProps>();

// Refs
const canvasRef = ref<HTMLCanvasElement | null>(null);
const targetPicture = ref<any>(null);
const width = props.width ?? 400;
const height = props.height ?? 400;
const columns = props.columns ?? 40;
const rows = props.rows ?? 40;

let hoveredImage = ref<{ col: number; row: number } | null>(null);
let overlayOpacity = ref(0.5);
let fadeInterval: any = null;

// Zoom state
const scale = ref(1);
const offsetX = ref(0);
const offsetY = ref(0);
const zoomFactor = 0.2;

// Pan state
const isPanning = ref(false);
const isMouse = ref(false);
const startX = ref(0);
const startY = ref(0);
const initialOffsetX = ref(0); // Khởi tạo giá trị ban đầu
const initialOffsetY = ref(0);

// Handle mousemove to detect hover
const handleMouseMove = (event: MouseEvent) => {
	if (!canvasRef.value) return;

	const { offset } = getMousePosition(event);

	// Adjust position for current zoom and pan
	const adjustedX = (offset.x - offsetX.value) / scale.value;
	const adjustedY = (offset.y - offsetY.value) / scale.value;

	const col = Math.floor((adjustedX / width) * columns);
	const row = Math.floor((adjustedY / height) * rows);

	hoveredImage.value = { col, row };
	overlayOpacity.value = 0.5; // Reset opacity

	// Clear any existing interval for fading
	if (fadeInterval) clearInterval(fadeInterval);

	// Start fading the overlay
	fadeInterval = window.setInterval(() => {
		overlayOpacity.value -= 0.2;
		if (overlayOpacity.value <= 0.1) {
			overlayOpacity.value = 0;
			clearInterval(fadeInterval); // Stop the fade when fully transparent
		}
		drawCanvas();
	}, 100);

	drawCanvas(); // Redraw with the new hover effect
};

const startPan = (event: MouseEvent) => {
	isPanning.value = true;
	isMouse.value = true;
	startX.value = event.clientX - offsetX.value;
	startY.value = event.clientY - offsetY.value;
};

// Handle pan movement
const panCanvas = (event: MouseEvent) => {
	handleMouseMove(event);
	if (!isPanning.value) return;
	deleteTooltip();
	isMouse.value = false;
	let newOffsetX = event.clientX - startX.value + initialOffsetX.value;
	let newOffsetY = event.clientY - startY.value + initialOffsetY.value;

	const scaledWidth = width * scale.value;
	const scaledHeight = height * scale.value;

	const minPanX = Math.min(0, width - scaledWidth);
	const minPanY = Math.min(0, height - scaledHeight);
	const maxPanX = Math.max(0, scaledWidth > width ? 0 : width - scaledWidth);
	const maxPanY = Math.max(
		0,
		scaledHeight > height ? 0 : height - scaledHeight
	);

	newOffsetX = Math.max(minPanX, Math.min(newOffsetX, maxPanX));
	newOffsetY = Math.max(minPanY, Math.min(newOffsetY, maxPanY));

	offsetX.value = newOffsetX;
	offsetY.value = newOffsetY;

	drawCanvas();
};

// Stop pan when mouse is released or leaves canvas
const endPan = () => {
	isPanning.value = false;
};

const handleZoom = async (event: WheelEvent) => {
	event.preventDefault();
	if (!canvasRef.value) return;

	deleteTooltip();

	const rect = canvasRef.value.getBoundingClientRect();
	const mouseX = event.clientX - rect.left;
	const mouseY = event.clientY - rect.top;

	const delta = event.deltaY < 0 ? 1 : -1;
	const zoomAmount = delta * zoomFactor;
	const newScale = Math.max(
		1,
		Math.min(calculateMaxZoomScale(), scale.value * (1 + zoomAmount))
	);

	const scaleRatio = newScale / scale.value;
	offsetX.value -= (mouseX - offsetX.value) * (scaleRatio - 1);
	offsetY.value -= (mouseY - offsetY.value) * (scaleRatio - 1);
	scale.value = newScale;

	const scaledWidth = width * scale.value;
	const scaledHeight = height * scale.value;

	const minPanX = Math.min(0, width - scaledWidth);
	const minPanY = Math.min(0, height - scaledHeight);
	const maxPanX = Math.max(0, scaledWidth > width ? 0 : width - scaledWidth);
	const maxPanY = Math.max(
		0,
		scaledHeight > height ? 0 : height - scaledHeight
	);

	offsetX.value = Math.max(minPanX, Math.min(offsetX.value, maxPanX));
	offsetY.value = Math.max(minPanY, Math.min(offsetY.value, maxPanY));

	Grid.colorBlending = newScale > 7 ? 0.2 : props.colorBlending ?? 0.8;
	await Grid.drawGrid(targetPicture.value);
	drawCanvas();
};

// Functions
const updateGrid = async () => {
	if (targetPicture.value && Grid.poolSize > 0) {
		const pixelAspectRatio = width / columns / (height / rows);
		targetPicture.value.setSize(columns, rows, pixelAspectRatio);

		await Grid.drawGrid(targetPicture.value);
		drawCanvas();
	}
};

const drawCanvas = () => {
	if (!canvasRef.value || !Grid.isReady) return;
	const context = canvasRef.value.getContext("2d");

	if (context) {
		// Clear canvas and apply transformations for zoom
		context.clearRect(0, 0, width, height);
		context.save();
		context.translate(offsetX.value, offsetY.value);
		context.scale(scale.value, scale.value);

		// Vẽ lại canvas với kích thước đã được scale
		context.drawImage(
			Grid.canvas as HTMLCanvasElement,
			0,
			0,
			width,
			height
		);

		// If an image is hovered, draw the overlay
		if (hoveredImage.value) {
			const imgWidth = width / columns;
			const imgHeight = height / rows;
			const { col, row } = hoveredImage.value;

			context.fillStyle = `rgba(248, 131, 188, ${overlayOpacity.value})`; // White overlay with variable opacity
			context.fillRect(
				col * imgWidth,
				row * imgHeight,
				imgWidth,
				imgHeight
			);
		}
		context.restore();
	}
};

const zoomToImage = (col: number, row: number) => {
	// Xóa tooltip hiện tại và làm mới canvas
	deleteTooltip();
	Grid.colorBlending = 0.2;
	drawCanvas();

	// Tính toán vị trí trung tâm của hình ảnh mới được click
	const clickedImageCenterX = (col + 0.5) * (width / columns);
	const clickedImageCenterY = (row + 0.5) * (height / rows);

	// Hiệu ứng zoom từ từ
	const targetScale = calculateMaxZoomScale();
	const zoomDuration = 500; // Thời gian zoom trong ms
	const zoomStartTime = performance.now();
	const initialScale = scale.value;
	const initialOffsetX = offsetX.value;
	const initialOffsetY = offsetY.value;

	// Hàm hoạt hình zoom
	const zoomAnimation = (currentTime: number) => {
		const elapsedTime = currentTime - zoomStartTime;
		const progress = Math.min(elapsedTime / zoomDuration, 1); // Tỉ lệ zoom từ 0 đến 1

		// Cập nhật tỷ lệ zoom dựa trên tỉ lệ hoàn thành
		scale.value = initialScale + (targetScale - initialScale) * progress;

		// Tính toán offset mới để căn chỉnh hình ảnh mới vào trung tâm canvas
		const newOffsetX = width / 2 - clickedImageCenterX * scale.value;
		const newOffsetY = height / 2 - clickedImageCenterY * scale.value;

		// Đảm bảo không hiển thị khoảng trắng trên canvas
		const scaledWidth = width * scale.value;
		const scaledHeight = height * scale.value;

		const minPanX = Math.min(0, width - scaledWidth);
		const minPanY = Math.min(0, height - scaledHeight);
		const maxPanX = Math.max(
			0,
			scaledWidth > width ? 0 : width - scaledWidth
		);
		const maxPanY = Math.max(
			0,
			scaledHeight > height ? 0 : height - scaledHeight
		);

		// Cập nhật vị trí pan để đảm bảo không có khoảng trắng
		if (initialScale == targetScale) {
			offsetX.value = Math.max(
				minPanX,
				Math.min(
					initialOffsetX + (newOffsetX - initialOffsetX) * progress,
					maxPanX
				)
			);
			offsetY.value = Math.max(
				minPanY,
				Math.min(
					initialOffsetY + (newOffsetY - initialOffsetY) * progress,
					maxPanY
				)
			);
		} else {
			offsetX.value = Math.max(minPanX, Math.min(newOffsetX, maxPanX));
			offsetY.value = Math.max(minPanY, Math.min(newOffsetY, maxPanY));
		}

		// Vẽ lại canvas với zoom và pan mới
		drawCanvas();
		if (progress < 1) {
			requestAnimationFrame(zoomAnimation);
		} else {
			// Khi zoom hoàn tất, vẽ lại lưới và hiển thị tooltip
			Grid.drawGrid(targetPicture.value);
			const color = Grid.getGridSquare(col, row);
			const pic: any = Grid.getPictureByColor(color);
			showTooltip(col, row, pic.image);
		}
	};

	requestAnimationFrame(zoomAnimation); // Bắt đầu hoạt hình zoom
};

// Cập nhật hàm clickCanvas để gọi zoomToImage với cột và hàng của ảnh được click
const clickedCanvas = (event: MouseEvent) => {
	if (canvasRef.value && isMouse.value) {
		const { offset } = getMousePosition(event);

		// Điều chỉnh vị trí click dựa theo scale hiện tại
		const adjustedX = (offset.x - offsetX.value) / scale.value;
		const adjustedY = (offset.y - offsetY.value) / scale.value;

		// Tính toán cột và hàng của hình ảnh được click
		const col = Math.floor((adjustedX / width) * columns);
		const row = Math.floor((adjustedY / height) * rows);

		// Thực hiện zoom vào hình ảnh được click
		zoomToImage(col, row);
	}
};

const calculateMaxZoomScale = (): number => {
	const imageWidth = width / columns;
	const imageHeight = height / rows;

	// Size of the canvas area covered by 3x3 images at max zoom
	const maxWidth = imageWidth * 3;
	const maxHeight = imageHeight * 3;

	// Calculate the max scale needed to zoom in so that only 3x3 images fit
	const maxZoomScaleX = width / maxWidth;
	const maxZoomScaleY = height / maxHeight;

	// Return the smaller of the two to ensure the canvas fits within both dimensions
	return Math.min(maxZoomScaleX, maxZoomScaleY);
};

const showTooltip = (col: number, row: number, image: HTMLImageElement) => {
	// Xóa tooltip cũ nếu có
	deleteTooltip();

	if (!canvasRef.value || !image) return;

	const imgWidth = width / columns;
	const imgHeight = height / rows;

	// Tính toán kích thước và vị trí của tooltip
	const tooltipWidth = imgWidth * scale.value;
	const tooltipHeight = imgHeight * scale.value;

	const tooltipX = col * imgWidth * scale.value + offsetX.value;
	const tooltipY = row * imgHeight * scale.value + offsetY.value;

	// Đảm bảo tooltip nằm trong giới hạn canvas
	const canvasRect = canvasRef.value.getBoundingClientRect();
	const tooltipLeft = Math.max(0, tooltipX);
	const tooltipTop = Math.max(0, tooltipY);
	const tooltipRight = Math.min(canvasRect.width, tooltipLeft + tooltipWidth);
	const tooltipBottom = Math.min(
		canvasRect.height,
		tooltipTop + tooltipHeight
	);

	const tooltipDiv = document.createElement("div");
	tooltipDiv.id = "tooltip";
	tooltipDiv.style.position = "absolute";
	tooltipDiv.style.left = `${tooltipLeft + canvasRect.left - 10}px`;
	tooltipDiv.style.top = `${tooltipTop + canvasRect.top - 31}px`;
	tooltipDiv.style.width = `${tooltipRight - tooltipLeft + 20}px`;
	tooltipDiv.style.height = `${tooltipBottom - tooltipTop + 100}px`;
	tooltipDiv.style.display = "block";
	tooltipDiv.style.backgroundColor = "rgba(0, 0, 0, 0.75)";
	tooltipDiv.style.boxSizing = "border-box"; // Ensure padding and borders are included in width/height
	tooltipDiv.innerHTML = `
      <div id="editDiv">
          <a id="OSD_BTN_ENLARGE" class="osd_btn" href="#">Enlarge</a>
          <a id="OSD_BTN_LIKE" class="osd_btn" href="#">Like</a>
          <a id="OSD_BTN_COMMENT" class="osd_btn" href="#">Comment</a>
      </div>
       <div id="imgCont" style="padding:10px; padding-top:0">
         <img src="${image.src}"
          width="${tooltipRight - tooltipLeft}px"
          height="${tooltipBottom - tooltipTop}px" >
      </div>
      <div id="infoDiv">
          <span id="SmallPicTextAuthor">
              <a href="/samplemosaicpublic">samplemosaicpublic</a>
          </span>
          <span title="2019-09-06 14:49:51Z">5 years ago</span>
      </div>
    `;
	document.body.appendChild(tooltipDiv);
};

const deleteTooltip = () => {
	const existingTooltip = document.getElementById("tooltip");
	if (existingTooltip) {
		existingTooltip.remove();
	}
};

// VueUse watchEffect
watchEffect(() => {
	ImageLoader.crossOrigin = props.crossOrigin;
});

watchEffect(() => {
	Grid.colorBlending = props.colorBlending ?? 0.8;
	updateGrid();
});

watchEffect(async () => {
	if (props.target) {
		const pixelAspectRatio = width / columns / (height / rows);
		targetPicture.value = await createTargetPicture(
			props.target,
			columns,
			rows,
			pixelAspectRatio
		);
		updateGrid();
	}
});

watchEffect(() => {
	if (props.sources) {
		updateSources(
			props.sources,
			(progress) => {
				if (props.onLoadProgress) props.onLoadProgress(progress);
			},
			updateGrid
		);
	}
});

onMounted(() => {
	if (canvasRef.value) {
		canvasRef.value.width = width;
		canvasRef.value.height = height;
	}
	Grid.setSize(width * 20, height * 20, columns, rows);
	updateGrid();
});
</script>
<style>
div#tooltip a {
	color: #fff;
	text-decoration: none;
}
#editDiv a {
	font-size: 12px;
	margin: 13px;
	line-height: 2.6;
}

#SmallPicTextAuthor {
	margin-bottom: 5px;
}

#infoDiv span {
	font-size: 12px;
	margin-left: 13px;
	color: #fff;
	display: block;
}
</style>
