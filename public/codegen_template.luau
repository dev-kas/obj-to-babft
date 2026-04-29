local Players = game:GetService("Players")
local player = Players.LocalPlayer

-- API
print("Loading API...")
local function getToolRF(toolName)
	local character = player.Character or player.CharacterAdded:Wait()
	local tool = player.Backpack:FindFirstChild(toolName) or character:FindFirstChild(toolName)
	return tool and tool:FindFirstChild("RF")
end

local function getTargetFolder()
	local blocksRoot = workspace:WaitForChild("Blocks")
	local folderName = player.Name

	local settings = player:FindFirstChild("Settings")
	if settings and settings:FindFirstChild("ShareBlocks") and settings.ShareBlocks.Value then
		local team = player.Team
		if team and team:FindFirstChild("TeamLeader") then
			folderName = team.TeamLeader.Value
		end
	end

	return blocksRoot:WaitForChild(folderName)
end

local function NewBlock(blockName, offsetCFrame)
	local RF = getToolRF("BuildingTool")
	if not RF then
		warn("BuildingTool RF not found!")
		return nil
	end

	local targetFolder = getTargetFolder()
	local targetZone = workspace:FindFirstChild(tostring(player.TeamColor) .. "Zone")
	if not targetZone then
		warn("Target Zone not found!")
		return nil
	end

	local itemData = player:WaitForChild("Data"):WaitForChild(blockName).Value

	local worldCFrame = targetZone.CFrame * offsetCFrame
	local relativeCF = offsetCFrame

	local newBlock = nil
	local conn
	conn = targetFolder.ChildAdded:Connect(function(child)
		newBlock = child
		if conn then
			conn:Disconnect()
			conn = nil
		end
	end)

	RF:InvokeServer(blockName, itemData, targetZone, relativeCF, true, worldCFrame, false)

	local start = tick()
	repeat
		task.wait()
	until newBlock or (tick() - start > 10)
	if conn then
		conn:Disconnect()
	end

	return newBlock
end

local function ScaleBlock(blockInstance, newSize)
	local RF = getToolRF("ScalingTool")
	if not (RF and blockInstance and blockInstance.PrimaryPart) then
		return
	end
	RF:InvokeServer(blockInstance, newSize, blockInstance.PrimaryPart.CFrame)
end
print("API Loaded! Starting to build model...")

-- processing codegen data and rendering them in the environment via API
local blockname = "MetalBlock"
local sequence = CODEGEN_INJECTED
if sequence == nil then
	error("codegen injection failed. please retry")
end
if #sequence % 10 ~= 0 then
	error("corrupted codegen stream data. please retry")
end

local total = #sequence / 10
local start = os.clock()

for i = 1, #sequence, 10 do
	local index = ((i - 1) / 10) + 1

	-- data extraction
	local posX = sequence[i + 0]
	local posY = sequence[i + 1]
	local posZ = sequence[i + 2]

	local rotX = sequence[i + 3]
	local rotY = sequence[i + 4]
	local rotZ = sequence[i + 5]
	local rotW = sequence[i + 6]

	local sizX = sequence[i + 7]
	local sizY = sequence[i + 8]
	local sizZ = sequence[i + 9]

	local cf = CFrame.new(posX,posY,posZ,rotX,rotY,rotZ,rotW)
	local sz = Vector3.new(sizX,sizY,sizZ)

	local block = NewBlock(blockname, cf)
	if block then
		ScaleBlock(block, sz)
	end

	if index % 50 == 0 or index == total then
		local elapsed = os.clock() - start
		local rate = index / elapsed
		local remaining = total - index
		local eta = remaining / rate

		print((
			"%d/%d | %.2f b/s | ETA %.1fs"
		):format(index, total, rate, eta))
	end
end

print("Model build complete")
